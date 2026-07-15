#!/usr/bin/env python3
# Firestore rules test — emulator/Java GEREKMEZ, Firebase Rules Test API kullanır.
# Çalıştır:  python3 docs/test-firestore-rules.py [RULES_DOSYASI]
# Varsayılan RULES dosyası: docs/firestore.rules.DRAFT
# Token: firebase-tools login'inden (whitecrossbarbers@gmail.com) üretilir.
import sys, json, os, urllib.request

RULES_FILE = sys.argv[1] if len(sys.argv) > 1 else "salown-app/firestore.rules"
CFG = os.path.expanduser("~/.config/configstore/firebase-tools.json")
RT = json.load(open(CFG))["tokens"]["refresh_token"]
tok_req = urllib.request.Request("https://oauth2.googleapis.com/token",
    data=urllib.parse.urlencode({
        "client_id":"563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com",
        "client_secret":"j9iVZfS8kkCEFUPaAeJV0sAi","grant_type":"refresh_token","refresh_token":RT
    }).encode())
token = json.load(urllib.request.urlopen(tok_req))["access_token"]

RULES = open(RULES_FILE).read()
BASE = "/databases/(default)/documents"; T = "2026-06-21T12:00:00Z"
def req(m,p,auth=None,indata=None):
    r={"method":m,"path":BASE+p,"time":T}
    if auth is not None: r["auth"]=auth
    if indata is not None: r["resource"]={"data":indata}
    return r
# [G1] token'lar artık tenantRole taşır (null→admin fallback kaldırıldı). WX = genel admin üye.
WX={"uid":"wx1","token":{"tenantId":"whitecross","tenantRole":"admin"}}
WXSTAFF={"uid":"wxs","token":{"tenantId":"whitecross","tenantRole":"staff"}}
WXNOROLE={"uid":"wxn","token":{"tenantId":"whitecross"}}  # claim'siz (ölü/test tenant senaryosu)
HERO={"uid":"h1","token":{"tenantId":"herohairs","tenantRole":"admin"}}
SUP={"uid":"s1","token":{"superAdmin":True,"tenantId":"whitecross"}}
WXOWNER={"uid":"wo1","token":{"tenantId":"whitecross","tenantRole":"owner"}}
HEROOWNER={"uid":"ho1","token":{"tenantId":"herohairs","tenantRole":"owner"}}
def case(n,e,r,res=None):
    tc={"expectation":e,"request":r,"_name":n}
    if res is not None: tc["resource"]={"data":res}
    return tc
cases=[
 case("WX→HERO clients read","DENY",req("get","/tenants/herohairs/clients/c1",WX)),
 case("WX→HERO clients write","DENY",req("update","/tenants/herohairs/clients/c1",WX,{"x":1}),{"x":0}),
 case("WX→HERO deep campaignsSent","DENY",req("get","/tenants/herohairs/clients/c1/campaignsSent/x",WX)),
 case("WX→HERO booking delete","DENY",req("delete","/tenants/herohairs/bookings/b1",WX),{"status":"CONFIRMED"}),
 case("WX booking create","ALLOW",req("create","/tenants/whitecross/bookings/b1",WX,{"status":"CONFIRMED"})),
 case("WX checkout(update)","ALLOW",req("update","/tenants/whitecross/bookings/b1",WX,{"paidAmount":50}),{"status":"CONFIRMED"}),
 case("WX deep campaignsSent","ALLOW",req("get","/tenants/whitecross/clients/c1/campaignsSent/x",WX)),
 case("WX clients write","ALLOW",req("update","/tenants/whitecross/clients/c1",WX,{"n":"a"}),{"n":"b"}),
 case("WX tenant-root write(Settings)","ALLOW",req("update","/tenants/whitecross",WX,{"features":{}}),{"name":"WX"}),
 case("UNAUTH public booking create","ALLOW",req("create","/tenants/whitecross/bookings/b2",None,{"status":"PENDING"})),
 case("UNAUTH read services","ALLOW",req("get","/tenants/whitecross/services/s1",None)),
 case("UNAUTH cancel update(only status)","ALLOW",req("update","/tenants/whitecross/bookings/b1",None,{"clientEmail":"a@b.com","bookingId":"WCB-1","status":"CANCELLED"}),{"clientEmail":"a@b.com","bookingId":"WCB-1","status":"CONFIRMED"}),
 case("UNAUTH forbidden field update","DENY",req("update","/tenants/whitecross/bookings/b1",None,{"clientEmail":"a@b.com","bookingId":"WCB-1","paidAmount":999}),{"clientEmail":"a@b.com","bookingId":"WCB-1","paidAmount":0}),
 case("SUPER→HERO clients write","ALLOW",req("update","/tenants/herohairs/clients/c1",SUP,{"x":1}),{"x":0}),
 case("SUPER top-level fallback","ALLOW",req("get","/randomTop/x",SUP)),
 case("WX top-level fallback","DENY",req("get","/randomTop/x",WX)),
 # ── [G2] (2026-06-24) bookings read artık auth-only (GDPR PII deliği kapatıldı) ──
 case("G2: UNAUTH booking read → DENY","DENY",req("get","/tenants/whitecross/bookings/b1",None)),
 case("G2: WX kendi booking read → ALLOW (panel/staff)","ALLOW",req("get","/tenants/whitecross/bookings/b1",WX)),
 case("G2: WX→HERO cross-tenant booking read → DENY","DENY",req("get","/tenants/herohairs/bookings/b1",WX)),
 case("G2: SUPER booking read → ALLOW","ALLOW",req("get","/tenants/herohairs/bookings/b1",SUP)),
 # ── [G3] (2026-06-24) public create money-field forge engellendi ──
 case("G3: UNAUTH create + paidAmount → DENY","DENY",req("create","/tenants/whitecross/bookings/b3",None,{"status":"PENDING","paidAmount":999})),
 case("G3: UNAUTH create + tip → DENY","DENY",req("create","/tenants/whitecross/bookings/b3",None,{"status":"PENDING","tip":50})),
 case("G3: UNAUTH create + discount → DENY","DENY",req("create","/tenants/whitecross/bookings/b3",None,{"status":"PENDING","discount":10})),
 case("G3: UNAUTH plain create (paymentState/Type ok) → ALLOW (whitecross-site)","ALLOW",req("create","/tenants/whitecross/bookings/b3",None,{"status":"PENDING","paymentState":"PENDING","paymentType":"DEPOSIT"})),
 case("G3: WX(auth) create + paidAmount → ALLOW (panel walk-in/checkout)","ALLOW",req("create","/tenants/whitecross/bookings/b4",WX,{"status":"CONFIRMED","paidAmount":50})),
 # ── [G1] rol-claim fallback kaldırıldı: claim'siz user artık admin DEĞİL ──
 case("G1: WXNOROLE tenant-root write → DENY (admin değil)","DENY",req("update","/tenants/whitecross",WXNOROLE,{"features":{}}),{"name":"WX"}),
 case("G1: WXNOROLE booking read → ALLOW (isTenantAny hâlâ yeter)","ALLOW",req("get","/tenants/whitecross/bookings/b1",WXNOROLE)),
 # ── [G4] catch-all write kapatıldı: staff self-escalate + delete + P1-D artık bağlar ──
 case("G4: staff kendi staff-doc permissions write → DENY (self-escalate kapandı)","DENY",req("update","/tenants/whitecross/staff/wxs",WXSTAFF,{"permissions":{"canViewRevenue":True}}),{"role":"staff"}),
 # [DEL] (2026-07-02) staff atama (ekle/rol/izin) artık super-admin only — admin DENY
 case("DEL: admin → staff-doc write → DENY (atama super-admin only)","DENY",req("update","/tenants/whitecross/staff/u2",WX,{"permissions":{"canViewRevenue":True}}),{"role":"staff"}),
 case("DEL: SUPER → staff-doc write → ALLOW","ALLOW",req("update","/tenants/whitecross/staff/u2",SUP,{"permissions":{"canViewRevenue":True}}),{"role":"staff"}),
 case("DEL: admin → staff create → DENY","DENY",req("create","/tenants/whitecross/staff/u3",WX,{"role":"staff","email":"x@y.com"})),
 case("DEL: SUPER → staff create → ALLOW","ALLOW",req("create","/tenants/whitecross/staff/u3",SUP,{"role":"staff","email":"x@y.com"})),
 case("G4: staff tenant-root write → DENY (admin-only)","DENY",req("update","/tenants/whitecross",WXSTAFF,{"features":{}}),{"name":"WX"}),
 case("G4: admin profileStatus write → DENY (P1-D korumalı)","DENY",req("update","/tenants/whitecross",WX,{"profileStatus":"published"}),{"name":"WX"}),
 case("G4: staff booking delete → DENY (admin-only, catch-all artık vermiyor)","DENY",req("delete","/tenants/whitecross/bookings/b1",WXSTAFF),{"status":"CONFIRMED"}),
 # ── [DEL] (2026-07-02) delete = super-admin only sistem geneli (feedback_delete_superadmin_only) ──
 case("DEL: admin booking delete → DENY (artık super-admin only)","DENY",req("delete","/tenants/whitecross/bookings/b1",WX),{"status":"CONFIRMED"}),
 case("DEL: SUPER booking delete → ALLOW","ALLOW",req("delete","/tenants/whitecross/bookings/b1",SUP),{"status":"CONFIRMED"}),
 case("DEL: admin client delete → DENY","DENY",req("delete","/tenants/whitecross/clients/c1",WX),{"name":"x"}),
 case("DEL: SUPER client delete → ALLOW","ALLOW",req("delete","/tenants/whitecross/clients/c1",SUP),{"name":"x"}),
 case("DEL: admin finance_expenses delete → DENY","DENY",req("delete","/tenants/whitecross/finance_expenses/e1",WX),{"amount":1}),
 case("DEL: SUPER finance_expenses delete → ALLOW","ALLOW",req("delete","/tenants/whitecross/finance_expenses/e1",SUP),{"amount":1}),
 case("DEL: admin service delete → DENY","DENY",req("delete","/tenants/whitecross/services/s1",WX),{"name":"cut"}),
 case("DEL: SUPER service delete → ALLOW","ALLOW",req("delete","/tenants/whitecross/services/s1",SUP),{"name":"cut"}),
 case("DEL: admin product delete → DENY","DENY",req("delete","/tenants/whitecross/products/p1",WX),{"name":"wax"}),
 case("DEL: admin campaign delete → DENY","DENY",req("delete","/tenants/whitecross/campaigns/c1",WX),{"name":"x"}),
 case("DEL: admin staff delete → DENY","DENY",req("delete","/tenants/whitecross/staff/u2",WX),{"role":"staff"}),
 case("DEL: SUPER staff delete → ALLOW","ALLOW",req("delete","/tenants/whitecross/staff/u2",SUP),{"role":"staff"}),
 # sanity: create/update HÂLÂ çalışıyor (delete kısıtı bunları bozmadı)
 case("DEL: admin finance_expenses create → ALLOW (delete kısıtı create'i bozmadı)","ALLOW",req("create","/tenants/whitecross/finance_expenses/e2",WX,{"amount":5})),
 case("DEL: admin service update → ALLOW","ALLOW",req("update","/tenants/whitecross/services/s1",WX,{"name":"cut2"}),{"name":"cut"}),
 case("G4: bilinmeyen koleksiyona write → DENY (catch-all write=false)","DENY",req("update","/tenants/whitecross/randomColl/x",WXSTAFF,{"a":1}),{"a":0}),
 case("G4: bilinmeyen koleksiyona read → ALLOW (catch-all read açık)","ALLOW",req("get","/tenants/whitecross/randomColl/x",WXSTAFF)),
 # ── [G4] enumerate edilen yazılır koleksiyonlar — üye (staff) yazabilmeli (eksik kalmadı kontrolü) ──
 case("G4 col: settings write → ALLOW","ALLOW",req("update","/tenants/whitecross/settings/settings",WXSTAFF,{"a":1}),{"a":0}),
 case("G4 col: campaigns write → ALLOW","ALLOW",req("create","/tenants/whitecross/campaigns/c1",WXSTAFF,{"a":1})),
 case("G4 col: auditLogs write → ALLOW","ALLOW",req("create","/tenants/whitecross/auditLogs/a1",WXSTAFF,{"a":1})),
 case("G4 col: notifications write → ALLOW","ALLOW",req("create","/tenants/whitecross/notifications/n1",WXSTAFF,{"a":1})),
 case("G4 col: fcmTokens write → ALLOW","ALLOW",req("create","/tenants/whitecross/fcmTokens/t1",WXSTAFF,{"a":1})),
 case("G4 col: products write → ALLOW","ALLOW",req("create","/tenants/whitecross/products/p1",WXSTAFF,{"a":1})),
 case("G4 col: team write → ALLOW","ALLOW",req("create","/tenants/whitecross/team/t1",WXSTAFF,{"a":1})),
 case("G4 col: finance write → ALLOW","ALLOW",req("create","/tenants/whitecross/finance/f1",WXSTAFF,{"a":1})),
 case("G4 col: finance_expenses write → ALLOW","ALLOW",req("create","/tenants/whitecross/finance_expenses/e1",WXSTAFF,{"a":1})),
 case("G4 col: finance_payments write → ALLOW","ALLOW",req("create","/tenants/whitecross/finance_payments/p1",WXSTAFF,{"a":1})),
 case("G4 col: expenses write → ALLOW","ALLOW",req("create","/tenants/whitecross/expenses/e1",WXSTAFF,{"a":1})),
 case("G4 col: advances write → ALLOW","ALLOW",req("create","/tenants/whitecross/advances/a1",WXSTAFF,{"a":1})),
 case("G4 col: investment_transactions write → ALLOW","ALLOW",req("create","/tenants/whitecross/investment_transactions/i1",WXSTAFF,{"a":1})),
 case("G4 col: clients deep campaignsSent write → ALLOW","ALLOW",req("create","/tenants/whitecross/clients/c1/campaignsSent/s1",WXSTAFF,{"a":1})),
 # ── E1b (2026-07-11): delete = super-admin VEYA aynı-tenant OWNER ──
 case("E1b: owner own-tenant booking delete → ALLOW","ALLOW",req("delete","/tenants/herohairs/bookings/b1",HEROOWNER,None),{"clientName":"x"}),
 case("E1b: owner own-tenant client delete → ALLOW","ALLOW",req("delete","/tenants/herohairs/clients/c1",HEROOWNER,None),{"name":"x"}),
 case("E1b: owner own-tenant service delete → ALLOW","ALLOW",req("delete","/tenants/herohairs/services/s1",HEROOWNER,None),{"name":"x"}),
 case("E1b: owner own-tenant product delete → ALLOW","ALLOW",req("delete","/tenants/herohairs/products/p1",HEROOWNER,None),{"name":"x"}),
 case("E1b: owner own-tenant gallery delete → ALLOW","ALLOW",req("delete","/tenants/herohairs/gallery/g1",HEROOWNER,None),{"u":"x"}),
 case("E1b: owner own-tenant campaign delete → ALLOW","ALLOW",req("delete","/tenants/herohairs/campaigns/k1",HEROOWNER,None),{"name":"x"}),
 case("E1b: owner own-tenant discountCode delete → ALLOW","ALLOW",req("delete","/tenants/herohairs/discountCodes/d1",HEROOWNER,None),{"code":"X"}),
 case("E1b: owner CROSS-tenant booking delete → DENY","DENY",req("delete","/tenants/whitecross/bookings/b1",HEROOWNER,None),{"clientName":"x"}),
 case("E1b: ADMIN (Arda) own-tenant booking delete → DENY","DENY",req("delete","/tenants/whitecross/bookings/b1",WX,None),{"clientName":"x"}),
 case("E1b: STAFF own-tenant booking delete → DENY","DENY",req("delete","/tenants/whitecross/bookings/b1",WXSTAFF,None),{"clientName":"x"}),
 case("E1b: owner STAFF-doc delete → DENY (staff mgmt super-only)","DENY",req("delete","/tenants/whitecross/staff/u1",WXOWNER,None),{"role":"staff"}),
 case("E1b+: owner own-tenant BARBER delete → ALLOW","ALLOW",req("delete","/tenants/whitecross/barbers/br1",WXOWNER,None),{"name":"x"}),
 case("E1b+: owner CROSS-tenant BARBER delete → DENY","DENY",req("delete","/tenants/whitecross/barbers/br1",HEROOWNER,None),{"name":"x"}),
 case("E1b+: ADMIN barber delete → DENY","DENY",req("delete","/tenants/whitecross/barbers/br1",WX,None),{"name":"x"}),
 case("E1b: owner TENANT ROOT delete → DENY","DENY",req("delete","/tenants/whitecross",WXOWNER,None),{"name":"x"}),
 case("E1b: owner FINANCE delete → DENY","DENY",req("delete","/tenants/whitecross/finance/f1",WXOWNER,None),{"a":1}),
 case("E1b: owner SETTINGS delete → DENY","DENY",req("delete","/tenants/whitecross/settings/settings",WXOWNER,None),{"a":1}),
 case("E1b: owner AUDITLOG delete → DENY","DENY",req("delete","/tenants/whitecross/auditLogs/a1",WXOWNER,None),{"a":1}),
 # ── [S1] (2026-07-15) staffComp: comp verisi owner+super-only (STAFF_MANAGEMENT_DESIGN §1.3).
 #    Catch-all READ staffComp'u dışlayacak şekilde daraltıldı (OR-semantiği) — admin/staff DENY şart.
 case("S1: owner staffComp read → ALLOW","ALLOW",req("get","/tenants/whitecross/staffComp/br1",WXOWNER),{"barberId":"br1"}),
 case("S1: owner staffComp write → ALLOW","ALLOW",req("update","/tenants/whitecross/staffComp/br1",WXOWNER,{"history":[]}),{"barberId":"br1"}),
 case("S1: SUPER staffComp read → ALLOW","ALLOW",req("get","/tenants/whitecross/staffComp/br1",SUP),{"barberId":"br1"}),
 case("S1: SUPER staffComp write → ALLOW","ALLOW",req("update","/tenants/whitecross/staffComp/br1",SUP,{"history":[]}),{"barberId":"br1"}),
 case("S1: ADMIN staffComp read → DENY (finansal veri)","DENY",req("get","/tenants/whitecross/staffComp/br1",WX),{"barberId":"br1"}),
 case("S1: ADMIN staffComp write → DENY","DENY",req("update","/tenants/whitecross/staffComp/br1",WX,{"history":[]}),{"barberId":"br1"}),
 case("S1: STAFF staffComp read → DENY","DENY",req("get","/tenants/whitecross/staffComp/br1",WXSTAFF),{"barberId":"br1"}),
 case("S1: UNAUTH staffComp read → DENY","DENY",req("get","/tenants/whitecross/staffComp/br1",None),{"barberId":"br1"}),
 case("S1: CROSS-tenant owner staffComp read → DENY","DENY",req("get","/tenants/whitecross/staffComp/br1",HEROOWNER),{"barberId":"br1"}),
 case("S1: catch-all regresyon — admin rastgele koleksiyon read hâlâ ALLOW","ALLOW",req("get","/tenants/whitecross/someRandomColl/x1",WX),{"a":1}),
 case("S1: catch-all regresyon — admin derin path read hâlâ ALLOW","ALLOW",req("get","/tenants/whitecross/someColl/x1/sub/y1",WX),{"a":1}),
 case("S1: catch-all write hâlâ kapalı — admin rastgele koleksiyon write DENY","DENY",req("update","/tenants/whitecross/someRandomColl/x1",WX,{"a":2}),{"a":1}),
]
url="https://firebaserules.googleapis.com/v1/projects/havuz-44f70:test"
body={"source":{"files":[{"name":"firestore.rules","content":RULES}]},
      "testSuite":{"testCases":[{k:v for k,v in c.items() if k!="_name"} for c in cases]}}
r=urllib.request.Request(url,data=json.dumps(body).encode(),
    headers={"Authorization":f"Bearer {token}","Content-Type":"application/json"})
resp=json.load(urllib.request.urlopen(r))
print(f"RULES: {RULES_FILE}")
ok=0
for c,res in zip(cases,resp.get("testResults",[])):
    st=res.get("state","?"); m="✅" if st=="SUCCESS" else "❌"; ok+= st=="SUCCESS"
    print(f"  {m} [{c['expectation']:5}] {c['_name']} → {st}")
print(f"  ---- {ok}/{len(cases)} geçti ----")
