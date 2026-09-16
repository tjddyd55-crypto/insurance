import json, urllib.request
API='http://127.0.0.1:3001/backend/api'
USER='tjddyd55'; PASS='QaBizFire20260910!'

def post(path, body, token=None):
  req=urllib.request.Request(API+path, data=json.dumps(body).encode(), headers={'Content-Type':'application/json', **({'Authorization':'Bearer '+token} if token else {})}, method='POST')
  with urllib.request.urlopen(req) as r: return json.load(r)

def get(path, token):
  req=urllib.request.Request(API+path, headers={'Authorization':'Bearer '+token})
  with urllib.request.urlopen(req) as r: return json.load(r)

login=post('/auth/login', {'username':USER,'password':PASS})
token=login['token']
c=get('/customers/1342', token)
locs=get('/customers/1342/fire-insurance-locations', token)
print(json.dumps({
  'stillCustomer': c.get('id')==1342,
  'name': c.get('name'),
  'businessInfo': c.get('businessInfo'),
  'fire': [{'id':x.get('id'),'memo':x.get('memo'),'address':x.get('address')} for x in (locs if isinstance(locs,list) else locs.get('locations') or locs.get('items') or [])],
}, ensure_ascii=False, indent=2))
