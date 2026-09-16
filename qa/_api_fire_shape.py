import json, urllib.request
API='http://127.0.0.1:3001/backend/api'

def req(method, path, body=None, token=None):
  data=None if body is None else json.dumps(body).encode()
  headers={'Content-Type':'application/json'}
  if token: headers['Authorization']='Bearer '+token
  r=urllib.request.Request(API+path, data=data, headers=headers, method=method)
  with urllib.request.urlopen(r) as res:
    raw=res.read().decode()
    print('STATUS', res.status, path)
    print(raw[:1000])
    return json.loads(raw) if raw else None

login=req('POST','/auth/login',{'username':'tjddyd55','password':'QaBizFire20260910!'})
token=login['token']
for p in ['/customers/1342/fire-insurance-locations','/customers/1342/fireInsuranceLocations','/customers/1342']:
  try:
    j=req('GET', p, token=token)
    if p.endswith('1342'):
      print('keys', sorted(j.keys())[:40])
      print('fire fields', {k:j.get(k) for k in j if 'fire' in k.lower() or 'Fire' in k})
  except Exception as e:
    print('ERR', p, e)
