"""Sarasavi local demonstration server (Python 3.13; standard library only).
NOT a production web server. Protect admin & upload endpoints before public deployment.
"""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.request import Request, urlopen
from urllib.error import HTTPError
from pathlib import Path
from email.message import EmailMessage
from datetime import datetime, timezone
import base64, binascii, hashlib, hmac, json, os, secrets, smtplib, sqlite3, ssl, threading, uuid

ROOT = Path(__file__).resolve().parent
DATA = ROOT.parent / 'sarasavi_private_data'  # Outside served document root
DATA.mkdir(parents=True, exist_ok=True)
UPLOADS = DATA / 'artwork'
UPLOADS.mkdir(exist_ok=True)
DB = DATA / 'inquiries.sqlite3'
EMAIL = 'sarasavioffsetprinters@gmail.com'
LOCK = threading.RLock()
os.chdir(ROOT)
MAX_JSON = 7 * 1024 * 1024
MAX_UPLOAD = 4 * 1024 * 1024
ALLOWED = {'.pdf', '.png', '.jpg', '.jpeg'}
STATUSES = ('Received', 'Reviewing', 'Quoted', 'Approved', 'In production', 'Ready', 'Completed', 'Cancelled')

def initialize():
    with sqlite3.connect(DB) as c:
        c.execute('''CREATE TABLE IF NOT EXISTS orders (
           id INTEGER PRIMARY KEY AUTOINCREMENT, created_at TEXT NOT NULL,
           reference TEXT NOT NULL UNIQUE, pin_hash TEXT NOT NULL,
           customer_name TEXT NOT NULL, email TEXT NOT NULL, phone TEXT,
           product TEXT NOT NULL, quantity INTEGER NOT NULL, size TEXT,
           material TEXT, finishing TEXT, notes TEXT, upload_name TEXT,
           upload_file TEXT, status TEXT NOT NULL DEFAULT 'Received')''')

def pin_hash(pin):
    return hashlib.sha256(pin.encode('utf-8')).hexdigest()

def send_inquiry(subject, body):
    host=os.getenv('SMTP_HOST'); user=os.getenv('SMTP_USER'); password=os.getenv('SMTP_PASSWORD'); recipient=os.getenv('INQUIRY_TO')
    if not all((host,user,password,recipient)):
        return False
    msg=EmailMessage();msg['From']=user;msg['To']=recipient;msg['Subject']=subject[:150];msg.set_content(body)
    port=int(os.getenv('SMTP_PORT','465'))
    if port==465:
        with smtplib.SMTP_SSL(host,port,timeout=10,context=ssl.create_default_context()) as s:
            s.login(user,password);s.send_message(msg)
    else:
        with smtplib.SMTP(host,port,timeout=10) as s:
            s.starttls(context=ssl.create_default_context());s.login(user,password);s.send_message(msg)
    return True

class Handler(SimpleHTTPRequestHandler):
    def respond(self, status, obj):
        raw=json.dumps(obj,ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type','application/json; charset=utf-8')
        self.send_header('Cache-Control','no-store')
        self.send_header('X-Content-Type-Options','nosniff')
        self.send_header('Content-Length',str(len(raw)))
        self.end_headers();self.wfile.write(raw)

    def json_input(self):
        length=int(self.headers.get('Content-Length','0'))
        if not 0<length<=MAX_JSON:raise ValueError('Request is too large or empty')
        obj=json.loads(self.rfile.read(length))
        if not isinstance(obj,dict):raise ValueError('Invalid request')
        return obj

    def admin_ok(self):
        expected=os.getenv('SARASAVI_ADMIN_PASSWORD','')
        provided=self.headers.get('X-Admin-Password','')
        return len(expected)>=12 and hmac.compare_digest(provided,expected)

    def do_GET(self):
        if self.path.split('?')[0]=='/api/admin/orders':
            if not self.admin_ok():return self.respond(401,{'error':'Admin password required or not configured'})
            with LOCK, sqlite3.connect(DB) as c:
                c.row_factory=sqlite3.Row
                rows=[dict(row) for row in c.execute('SELECT id,created_at,reference,customer_name,email,phone,product,quantity,size,material,finishing,notes,upload_name,status FROM orders ORDER BY id DESC LIMIT 200')]
            return self.respond(200,{'orders':rows})
        return super().do_GET()

    def do_POST(self):
        if self.path not in ('/api/chat','/api/inquiry','/api/quote','/api/track','/api/admin/update'):
            return self.respond(404,{'error':'Not found'})
        try:
            obj=self.json_input()
            if self.path=='/api/quote':return self.quote(obj)
            if self.path=='/api/track':return self.track(obj)
            if self.path=='/api/admin/update':return self.update_order(obj)
            if self.path=='/api/inquiry':return self.inquiry(obj)
            return self.chat(obj)
        except (ValueError,TypeError,KeyError,json.JSONDecodeError,binascii.Error) as e:
            return self.respond(400,{'error':str(e)[:150]})
        except Exception as e:
            print('Server error:',type(e).__name__)
            return self.respond(500,{'error':'Unable to complete request. Please try again.'})

    def quote(self,obj):
        def field(k,n=200):
            value=obj.get(k,'')
            if not isinstance(value,str) or len(value)>n:raise ValueError('Invalid '+k)
            return value.strip()
        name=field('name',120);email=field('email',200);phone=field('phone',50)
        product=field('product',100);size=field('size');material=field('material');finishing=field('finishing');notes=field('notes',1800)
        if not name or not product or '@' not in email or len(email)<5:raise ValueError('Please enter your name, email and product')
        try:quantity=int(obj.get('quantity',0))
        except (ValueError,TypeError):raise ValueError('Invalid quantity')
        if not 1<=quantity<=10000000:raise ValueError('Please enter a valid quantity')
        attachment=obj.get('attachment');filename='';stored='';content=None
        if attachment is not None:
            if not isinstance(attachment,dict):raise ValueError('Invalid artwork')
            filename=str(attachment.get('name',''))
            if len(filename)>140 or Path(filename).suffix.lower() not in ALLOWED or '/' in filename or '\\' in filename:
                raise ValueError('Use PDF, PNG or JPG artwork with a simple filename')
            coded=attachment.get('base64','')
            if not isinstance(coded,str) or len(coded)>MAX_UPLOAD*4//3+32:raise ValueError('Artwork too large (4 MB maximum)')
            content=base64.b64decode(coded,validate=True)
            if not 0<len(content)<=MAX_UPLOAD:raise ValueError('Artwork too large')
            suffix=Path(filename).suffix.lower()
            matches=(suffix=='.pdf' and content.startswith(b'%PDF-')) or (suffix=='.png' and content.startswith(b'\x89PNG\r\n\x1a\n')) or (suffix in ('.jpg','.jpeg') and content.startswith(b'\xff\xd8\xff'))
            if not matches:raise ValueError('Artwork file format does not match its extension')
            stored=uuid.uuid4().hex+suffix
        ref='SV-'+secrets.token_hex(4).upper()
        pin=''.join(str(secrets.randbelow(10)) for _ in range(6))
        stamp=datetime.now(timezone.utc).isoformat(timespec='seconds')
        if content is not None:(UPLOADS/stored).write_bytes(content)
        with LOCK,sqlite3.connect(DB) as c:
            c.execute('''INSERT INTO orders (created_at,reference,pin_hash,customer_name,email,phone,product,quantity,size,material,finishing,notes,upload_name,upload_file,status)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)''',(stamp,ref,pin_hash(pin),name,email,phone,product,quantity,size,material,finishing,notes,filename,stored,'Received'))
        details=f'Reference: {ref}\nName: {name}\nEmail: {email}\nPhone: {phone}\nProduct: {product}\nQuantity: {quantity}\nSize: {size}\nMaterial: {material}\nFinishing: {finishing}\nNotes: {notes}\nArtwork uploaded to private local storage: {filename or "none"}'
        notified=False
        try:notified=send_inquiry('Sarasavi quotation request '+ref,details)
        except Exception:pass
        return self.respond(201,{'reference':ref,'pin':pin,'status':'Received','saved_locally':True,'business_notified':notified,'message':'Your request was saved on this server. Keep your reference and PIN.'})

    def track(self,obj):
        ref=str(obj.get('reference','')).strip().upper()[:40];pin=str(obj.get('pin',''))[:50]
        if not ref or not pin:return self.respond(400,{'error':'Enter a reference and PIN'})
        with LOCK,sqlite3.connect(DB) as c:
            row=c.execute('SELECT status,product,created_at,pin_hash FROM orders WHERE reference=?',(ref,)).fetchone()
        if not row or not hmac.compare_digest(row[3],pin_hash(pin)):
            return self.respond(404,{'error':'Reference or PIN not found'})
        return self.respond(200,{'reference':ref,'status':row[0],'product':row[1],'created_at':row[2]})

    def update_order(self,obj):
        if not self.admin_ok():return self.respond(401,{'error':'Admin password required or not configured'})
        ref=str(obj.get('reference','')).strip().upper()[:40];status=obj.get('status')
        if status not in STATUSES or not ref:raise ValueError('Invalid order status or reference')
        with LOCK,sqlite3.connect(DB) as c:
            result=c.execute('UPDATE orders SET status=? WHERE reference=?',(status,ref))
        return self.respond(200 if result.rowcount else 404,{'updated':bool(result.rowcount)})

    def inquiry(self,obj):
        fields=obj.get('fields',{});kind=str(obj.get('kind','Inquiry'))[:80]
        if not isinstance(fields,dict) or not fields:raise ValueError('Invalid fields')
        safe={}
        for key,value in fields.items():
            if not isinstance(key,str) or not isinstance(value,str) or len(key)>60 or len(value)>3000:raise ValueError('Invalid field')
            safe[key]=value
        if '@' not in safe.get('email',''):raise ValueError('Valid email required')
        try:sent=send_inquiry('Sarasavi website: '+kind,'\n'.join(f'{k}: {v}' for k,v in safe.items()))
        except Exception:sent=False
        return self.respond(200 if sent else 503,{'sent':sent,'error':None if sent else 'SMTP not configured or delivery failed'})

    def chat(self,obj):
        message=obj.get('message','')
        if not isinstance(message,str) or not 1<=len(message.strip())<=500:raise ValueError('Invalid chat message')
        api_key=os.getenv('OPENAI_API_KEY','')
        if not api_key:return self.respond(503,{'error':'AI mode is not configured. Using built-in FAQ replies.'})
        payload=json.dumps({'model':os.getenv('OPENAI_MODEL','gpt-4.1-mini'),'messages':[
          {'role':'system','content':'You support Sarasavi Offset Printers. Printing, packaging, labels, banners and finishing are listed on the website. Never invent prices, opening hours, delivery timelines or unsupported claims. For quotations refer customers to quote.html, tracking to tracking.html, and email '+EMAIL+'. Do not request sensitive data. Be concise and clear.'},
          {'role':'user','content':message}],'max_tokens':230}).encode()
        try:
            req=Request('https://api.openai.com/v1/chat/completions',data=payload,headers={'Authorization':'Bearer '+api_key,'Content-Type':'application/json'},method='POST')
            with urlopen(req,timeout=12) as response:answer=json.load(response)
            return self.respond(200,{'reply':answer['choices'][0]['message']['content']})
        except (HTTPError,TimeoutError,KeyError,OSError):return self.respond(502,{'error':'AI temporarily unavailable'})

if __name__=='__main__':
    initialize()
    print('Sarasavi website: http://localhost:8000')
    print('Private enquiry data:',DATA)
    print('Local admin is disabled until SARASAVI_ADMIN_PASSWORD (12+ characters) is configured.')
    ThreadingHTTPServer(('127.0.0.1',8000),Handler).serve_forever()
