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
def case(n,e,r,res=None,mocks=None):
    tc={"expectation":e,"request":r,"_name":n}
    if res is not None: tc["resource"]={"data":res}
    if mocks is not None: tc["functionMocks"]=mocks
    return tc
# [A1] STAFF-START-AUTHORITY (2026-08-14) — the booking create/update rules now call
#   exists()/get() on the referenced barber document (the availabilityFrom gate).
#   The Rules Test API does NOT auto-resolve those: with no functionMocks it raises
#   "Function not found error: Name: [exists]" and the whole rule evaluates to DENY.
#   That is a HARNESS gap, not a rules defect — production always resolves exists().
#   Cases that send a real barberId + date must therefore say which barber document
#   the gate should see. `barberDoc(...)` supplies exactly one path and nothing else,
#   which also keeps the cross-tenant guarantee honest: a rule reaching for another
#   tenant's barber would find no mock and fail loudly instead of silently passing.
def barberDoc(tenant,doc_id,data):
    """functionMocks for ONE barber path. data=None means the document is absent."""
    path=BASE+f"/tenants/{tenant}/barbers/{doc_id}"
    m=[{"function":"exists","args":[{"exactValue":path}],"result":{"value":data is not None}}]
    if data is not None:
        m.append({"function":"get","args":[{"exactValue":path}],"result":{"value":{"data":data}}})
    return m
# The live shape these compat payloads describe: a real, LEGACY barber document —
# no availabilityFrom at all, which is every barber document in production today.
LEGACY_BARBER={"name":"Alex","status":"active"}
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
 # ══════════════════════════════════════════════════════════════════════════════
 # [R1-A] (2026-07-24) BOOKING_SECURITY_POLICY_MIGRATION §R1 phase (a).
 #   Anonymous booking create may not forge SERVER-OWNED identity/linkage fields.
 #   Anonymous create itself STAYS ALLOWED (locked decision 18) — phase (b) is a
 #   SEPARATE, later change gated on H1 + W1 + E1. The "phase-B not implemented"
 #   guards at the bottom of this block pin that.
 #
 #   ⚠️ Callable / Admin SDK (salownCreateBooking) is the writer of these fields and
 #   BYPASSES Firestore rules entirely. It therefore CANNOT be represented here —
 #   the Rules Test API only models rule-evaluated requests. Do NOT add a case that
 #   emulates the callable as an anonymous or authenticated client: it would assert
 #   a permission the callable never asks for and would go green for the wrong
 #   reason. The callable's own guarantees are covered by its functions tests
 #   (functions/src/bookings/createBooking.ts FORBIDDEN_INPUT_KEYS + its test file).
 # ══════════════════════════════════════════════════════════════════════════════
 # Baseline compatibility — the EXACT payloads the two live public writers send today.
 # Hosted legacy direct-create — src/pages/BookingPage.tsx:739 (verbatim key set).
 *[case("R1-A compat: hosted legacy public create (BookingPage.tsx:739 payload) → ALLOW","ALLOW",
        req("create","/tenants/whitecross/bookings/wb1",None,{
          "bookingId":"WEB-1753370000-ab12","clientName":"Alexandre","name":"Alexandre",
          "clientEmail":"alex@example.com","clientPhone":"07700900123","service":"Skin Fade",
          "serviceId":"svc-1","variationId":None,"date":"2026-07-25","time":"3:30 PM",
          "duration":30,"price":25,"barber":"Alex","barberId":"barber-1777257519766",
          "barberName":"Alex","barberSelection":"customer","barberAutoAssigned":False,
          "startTime":"2026-07-25T14:30:00Z","endTime":"2026-07-25T15:00:00Z",
          "source":"Salown","status":s,"expiresAt":None,"createdAt":"2026-07-24T17:00:00Z"}),
        mocks=barberDoc("whitecross","barber-1777257519766",LEGACY_BARBER))
   for s in ["CONFIRMED","PENDING"]],
 # Whitecross premium single create — whitecross-site/script.js:1462 writeBookingStatus().
 case("R1-A compat: Whitecross premium single create (script.js:1462 payload) → ALLOW","ALLOW",
      req("create","/tenants/whitecross/bookings/WCB-1753370001",None,{
        "bookingId":"WCB-1753370001","tenantId":"whitecross","clientName":"Alexandre",
        "clientEmail":"alex@example.com","clientPhone":"07700900123","barberId":"barber-1",
        "barberName":"Alex","barberAutoAssigned":False,"barberSelection":"customer",
        "serviceId":"svc-1","duration":30,"date":"2026-07-25","time":"3:30 PM",
        "startTime":"2026-07-25T14:30:00Z","endTime":"2026-07-25T15:00:00Z","status":"PENDING",
        "paymentType":"DEPOSIT","paymentState":"PENDING","source":"Website",
        "updatedAt":"2026-07-24T17:00:00Z",
        "soldAddOns":[{"serviceId":"svc-2","name":"Beard","price":10,"qty":1,"duration":15}],
        "pendingCreatedAt":"2026-07-24T17:00:00Z","expiresAt":"2026-07-24T17:15:00Z"}),
      mocks=barberDoc("whitecross","barber-1",LEGACY_BARBER)),
 # Whitecross premium GROUP create — whitecross-site/script.js:1695 (group payload).
 case("R1-A compat: Whitecross premium GROUP create (script.js:1695 payload) → ALLOW","ALLOW",
      req("create","/tenants/whitecross/bookings/WCB-1753370002",None,{
        "bookingId":"WCB-1753370002","tenantId":"whitecross","name":"Alexandre",
        "email":"alex@example.com","phone":"07700900123","clientName":"Alexandre",
        "clientEmail":"alex@example.com","clientPhone":"07700900123","date":"2026-07-25",
        "time":"3:30 PM","barber":"barber-1","barberId":"barber-1","barberName":"Alex",
        "barberAutoAssigned":True,"barberSelection":"auto","service":"svc-1","serviceId":"svc-1",
        "price":50,"servicePrice":25,"depositPerPerson":10,"startTime":"2026-07-25T14:30:00Z",
        "endTime":"2026-07-25T15:00:00Z","status":"PENDING","paymentType":"DEPOSIT",
        "paymentState":"PENDING","source":"Website","groupId":"grp-1","groupSize":2,
        "groupLead":True,"groupIndex":0,"pendingCreatedAt":"2026-07-24T17:00:00Z",
        "expiresAt":"2026-07-24T17:15:00Z","updatedAt":"2026-07-24T17:00:00Z"}),
      mocks=barberDoc("whitecross","barber-1",LEGACY_BARBER)),
 # Each forbidden key, individually, on an otherwise-legitimate anonymous payload.
 *[case(f"R1-A: UNAUTH create + {k} → DENY","DENY",
        req("create","/tenants/whitecross/bookings/fb1",None,
            {"status":"PENDING","clientName":"Alexandre","clientEmail":"alex@example.com",
             "clientPhone":"07700900123","source":"Website", k:v}))
   for k,v in [("clientManualId","client-999"),("matchedBy","email_and_phone"),
               ("identityLinkedBy","server"),("identityLinkedAt","2026-07-24T17:00:00Z"),
               ("clientPhoneCanonical","447700900123"),("emailCanonical","alex@example.com"),
               ("note","Busy")]],
 # Multiple forbidden keys at once.
 case("R1-A: UNAUTH create + ALL 7 forbidden keys → DENY","DENY",
      req("create","/tenants/whitecross/bookings/fb2",None,{
        "status":"PENDING","clientName":"Alexandre","clientManualId":"client-999",
        "matchedBy":"email_and_phone","identityLinkedBy":"server",
        "identityLinkedAt":"2026-07-24T17:00:00Z","clientPhoneCanonical":"447700900123",
        "emailCanonical":"alex@example.com","note":"Quick block"})),
 case("R1-A: UNAUTH create + link field + money field → DENY (both clauses hold)","DENY",
      req("create","/tenants/whitecross/bookings/fb3",None,
          {"status":"PENDING","clientManualId":"client-999","paidAmount":999})),
 # Update branch: already an hasOnly allowlist — ASSERTED, not re-clauses (plan §R1(a)).
 *[case(f"R1-A: UNAUTH update adding {k} → DENY (update allowlist holds)","DENY",
        req("update","/tenants/whitecross/bookings/b1",None,
            {"clientEmail":"a@b.com","bookingId":"WCB-1","status":"CANCELLED", k:v}),
        {"clientEmail":"a@b.com","bookingId":"WCB-1","status":"CONFIRMED"})
   for k,v in [("clientManualId","client-999"),("matchedBy","phone"),
               ("identityLinkedBy","server"),("identityLinkedAt","2026-07-24T17:00:00Z"),
               ("clientPhoneCanonical","447700900123"),("emailCanonical","alex@example.com"),
               ("note","Busy")]],
 case("R1-A: UNAUTH update MODIFYING an existing clientManualId → DENY","DENY",
      req("update","/tenants/whitecross/bookings/b1",None,
          {"clientEmail":"a@b.com","bookingId":"WCB-1","clientManualId":"attacker-1"}),
      {"clientEmail":"a@b.com","bookingId":"WCB-1","clientManualId":"client-999"}),
 # G3 financial protection unchanged by the new clause (regression, all three keys).
 *[case(f"R1-A regression: UNAUTH create + {k} still → DENY (G3 intact)","DENY",
        req("create","/tenants/whitecross/bookings/fb4",None,{"status":"PENDING", k:1}))
   for k in ["paidAmount","discount","tip"]],
 # Authenticated staff/admin surfaces are on the isTenantAny() branch — UNAFFECTED.
 case("R1-A: STAFF create walk-in w/ note + clientManualId + paidAmount → ALLOW","ALLOW",
      req("create","/tenants/whitecross/bookings/sb1",WXSTAFF,{
        "bookingId":"WCB-1753370003-x1","clientName":"Alexandre","clientManualId":"client-999",
        "matchedBy":"manual_id","identityLinkedBy":"staff:wxs","identityLinkedAt":"2026-07-24T17:00:00Z",
        "clientPhoneCanonical":"447700900123","emailCanonical":"alex@example.com",
        "note":"regular — no.3 back and sides","status":"CONFIRMED","paidAmount":25,
        "source":"Walk-in","bookingType":"walkin"})),
 case("R1-A: ADMIN create booking w/ note + link fields → ALLOW","ALLOW",
      req("create","/tenants/whitecross/bookings/sb2",WX,{
        "clientName":"Alexandre","clientManualId":"client-999","note":"call before",
        "status":"CONFIRMED"})),
 # Staff BLOCKED / Busy block-time records — `note` carries the reserved semantics.
 case("R1-A: STAFF create BLOCKED block-time (note='Blocked') → ALLOW","ALLOW",
      req("create","/tenants/whitecross/bookings/blk1",WXSTAFF,{
        "bookingId":"BLOCKED-1753370004-x1","barberId":"Alex","barberName":"Alex",
        "status":"BLOCKED","startTime":"2026-07-25T14:30:00Z","endTime":"2026-07-25T15:00:00Z",
        "note":"Blocked","source":"block","blockKind":"block"})),
 case("R1-A: STAFF create Busy quick-block (note='Busy') → ALLOW","ALLOW",
      req("create","/tenants/whitecross/bookings/blk2",WXSTAFF,{
        "bookingId":"BLOCKED-1753370005-x1","barberId":"Alex","barberName":"Alex",
        "status":"BLOCKED","startTime":"2026-07-25T14:30:00Z","endTime":"2026-07-25T15:00:00Z",
        "note":"Busy","source":"block","blockKind":"busy"})),
 case("R1-A: UNAUTH create BLOCKED status → DENY (status gate, pre-existing)","DENY",
      req("create","/tenants/whitecross/bookings/blk3",None,{
        "status":"BLOCKED","barberId":"Alex","source":"block"})),
 # Cross-tenant staff — the new clause must not weaken tenant isolation.
 case("R1-A: WXSTAFF → HERO booking create → DENY (cross-tenant)","DENY",
      req("create","/tenants/herohairs/bookings/xt1",WXSTAFF,{
        "status":"CONFIRMED","clientName":"x","note":"n","clientManualId":"client-999"})),
 # Truth-pinning, NOT a weakening: a PLAIN cross-tenant create is allowed because it
 # satisfies the PUBLIC branch (status in PENDING/CONFIRMED, no money/link/note keys) —
 # exactly as any anonymous stranger's create would. It never reaches the tenant branch.
 # This is pre-existing, by design while public create is open, and is what R1 phase (b)
 # closes. The DENY case above is the meaningful one: the moment a cross-tenant caller
 # carries a staff-only field, the public branch rejects it and the tenant branch fails.
 case("R1-A: WX(admin) → HERO plain create → ALLOW via PUBLIC branch (phase-b closes it)","ALLOW",
      req("create","/tenants/herohairs/bookings/xt2",WX,{"status":"CONFIRMED","clientName":"x"})),
 case("R1-A: WX(admin) → HERO create w/ note → DENY (public branch rejects, tenant fails)","DENY",
      req("create","/tenants/herohairs/bookings/xt3",WX,{"status":"CONFIRMED","note":"n"})),
 case("R1-A: WXSTAFF → HERO booking read → DENY (cross-tenant regression)","DENY",
      req("get","/tenants/herohairs/bookings/b1",WXSTAFF),{"clientName":"x"}),
 # PHASE-B GUARD — anonymous direct create must REMAIN available (locked decision 18).
 # If any of these three flips to DENY, phase (b) has been implemented by accident.
 case("R1-A phase-B guard: UNAUTH plain PENDING create → still ALLOW","ALLOW",
      req("create","/tenants/whitecross/bookings/pb1",None,{"status":"PENDING"})),
 case("R1-A phase-B guard: UNAUTH plain CONFIRMED create → still ALLOW","ALLOW",
      req("create","/tenants/whitecross/bookings/pb2",None,{"status":"CONFIRMED"})),
 case("R1-A phase-B guard: UNAUTH create w/ paymentState/paymentType → still ALLOW","ALLOW",
      req("create","/tenants/whitecross/bookings/pb3",None,{
        "status":"PENDING","paymentState":"PENDING","paymentType":"DEPOSIT"})),

 # ── [TR-A] presentation is owner/super-admin only ───────────────────────────
 # Regional settings decide the salon's CURRENCY and its calendar day. The
 # Settings tab is hidden for non-owners, but hiding a control is not a control.
 # Everything ELSE on the settings docs must keep working for admins and staff —
 # that is what the first three cases pin.
 case("TR-A: WXSTAFF writes a NON-presentation settings field → still ALLOW (no regression)","ALLOW",
      req("update","/tenants/whitecross/settings/settings",WXSTAFF,{"shopName":"X","loyalty":{"enabled":True}}),
      {"shopName":"Y"}),
 case("TR-A: WX(admin) writes a NON-presentation settings field → still ALLOW (no regression)","ALLOW",
      req("update","/tenants/whitecross/settings/settings",WX,{"shopName":"X"}),{"shopName":"Y"}),
 case("TR-A: WXSTAFF reads settings → still ALLOW (no regression)","ALLOW",
      req("get","/tenants/whitecross/settings/settings",WXSTAFF),{"shopName":"Y"}),
 case("TR-A: WXSTAFF writes presentation → DENY","DENY",
      req("update","/tenants/whitecross/settings/settings",WXSTAFF,
          {"presentation":{"currency":"TRY"}}),{"shopName":"Y"}),
 case("TR-A: WX(admin) writes presentation → DENY (owner-only, admins run the shop)","DENY",
      req("update","/tenants/whitecross/settings/settings",WX,
          {"presentation":{"currency":"TRY"}}),{"shopName":"Y"}),
 case("TR-A: WXOWNER writes presentation → ALLOW","ALLOW",
      req("update","/tenants/whitecross/settings/settings",WXOWNER,
          {"presentation":{"currency":"TRY","language":"tr"}}),{"shopName":"Y"}),
 case("TR-A: SUPER-ADMIN writes presentation → ALLOW","ALLOW",
      req("update","/tenants/whitecross/settings/settings",SUP,
          {"presentation":{"currency":"TRY"}}),{"shopName":"Y"}),
 case("TR-A: WXSTAFF CREATES a settings doc carrying presentation → DENY","DENY",
      req("create","/tenants/whitecross/settings/newdoc",WXSTAFF,{"presentation":{"currency":"TRY"}})),
 case("TR-A: WXOWNER CREATES a settings doc carrying presentation → ALLOW","ALLOW",
      req("create","/tenants/whitecross/settings/newdoc",WXOWNER,{"presentation":{"currency":"TRY"}})),
 case("TR-A: HEROOWNER writes WHITECROSS presentation → DENY (cross-tenant)","DENY",
      req("update","/tenants/whitecross/settings/settings",HEROOWNER,
          {"presentation":{"currency":"TRY"}}),{"shopName":"Y"}),
 # Root-doc PUBLIC MIRROR — same gate, so an admin cannot make the public
 # booking page disagree with the panel.
 case("TR-A: WX(admin) writes root-doc presentation mirror → DENY","DENY",
      req("update","/tenants/whitecross",WX,{"presentation":{"currency":"TRY"}}),{"name":"WC"}),
 case("TR-A: WXOWNER writes root-doc presentation mirror → ALLOW","ALLOW",
      req("update","/tenants/whitecross",WXOWNER,{"presentation":{"currency":"TRY"}}),{"name":"WC"}),
 case("TR-A: WX(admin) writes an unrelated root field → still ALLOW (no regression)","ALLOW",
      req("update","/tenants/whitecross",WX,{"phone":"123"}),{"name":"WC"}),
 # Presentation carries no secrets, so the world-readable root stays readable.
 case("TR-A: UNAUTH reads the tenant root (public mirror) → still ALLOW","ALLOW",
      req("get","/tenants/whitecross",None),{"name":"WC","presentation":{"language":"tr"}}),

 # ══════════════════════════════════════════════════════════════════════════════
 # [TR-D1 Phase 2B] (2026-08-02) The checkout executor's new SERVER-OWNED
 #   collections — `checkoutIntents` (the idempotency/result record) and
 #   `receivables` (ordinary salon debt and its schedule).
 #
 #   NO RULES CHANGE WAS MADE, and none is needed: neither collection is in the
 #   [G4] explicit write list, so the catch-all `allow write: if false` already
 #   denies every client write to them. These cases exist to PIN that, because
 #   the guarantee is a property of a list nobody edited rather than of a rule
 #   anybody wrote — and the day somebody adds one of these names to the [G4]
 #   list "so the panel can read it", this is what fails.
 #
 #   Read stays same-tenant ALLOW, deliberately: the till has to be able to show
 #   a client their outstanding balance, and the catch-all read has always been
 #   open. Tightening it belongs with the Admin/Staff UI cutover, not before.
 #
 #   ⚠️ The executor writes these documents with the Admin SDK, which BYPASSES
 #   rules entirely — the same caveat the [R1-A] block records. Do NOT add a case
 #   emulating the callable as a client: it would assert a permission the
 #   callable never asks for and go green for the wrong reason.
 # ══════════════════════════════════════════════════════════════════════════════
 case("TR-D1: ADMIN creates a checkoutIntent → DENY (server-owned)","DENY",
      req("create","/tenants/whitecross/checkoutIntents/i1",WX,{"status":"completed"})),
 case("TR-D1: ADMIN updates a checkoutIntent → DENY","DENY",
      req("update","/tenants/whitecross/checkoutIntents/i1",WX,{"status":"completed"}),{"status":"completed"}),
 case("TR-D1: OWNER updates a checkoutIntent → DENY (owner is not a bypass)","DENY",
      req("update","/tenants/whitecross/checkoutIntents/i1",WXOWNER,{"status":"x"}),{"status":"completed"}),
 case("TR-D1: STAFF creates a receivable → DENY (staff cannot forge salon debt)","DENY",
      req("create","/tenants/whitecross/receivables/r1",WXSTAFF,{"total_m":10000})),
 case("TR-D1: ADMIN writes off a receivable → DENY","DENY",
      req("update","/tenants/whitecross/receivables/r1",WX,{"total_m":0}),{"total_m":10000}),
 case("TR-D1: OWNER appends to the receivable ledger → DENY","DENY",
      req("create","/tenants/whitecross/receivableLedger/e1",WXOWNER,{"kind":"PAYMENT","amount_m":5000})),
 case("TR-D1: CROSS-tenant owner reads a receivable → DENY","DENY",
      req("get","/tenants/whitecross/receivables/r1",HEROOWNER),{"total_m":10000}),
 case("TR-D1: UNAUTH reads a checkoutIntent → DENY","DENY",
      req("get","/tenants/whitecross/checkoutIntents/i1",None),{"status":"completed"}),
 case("TR-D1: same-tenant admin READS a receivable → still ALLOW (catch-all read)","ALLOW",
      req("get","/tenants/whitecross/receivables/r1",WX),{"total_m":10000}),
 # ── [TR-D1 Phase 3] (2026-08-02) `checkoutSettings` is OWNER-or-super-admin only.
 #   Phase 1 shipped this gap OPEN on purpose (the feature was dark and nothing
 #   wrote the field) and recorded it as an explicit follow-on. The Settings UI
 #   now exposes the switches, so the gap closes with it. These decide WHO MAY
 #   CREATE SALON DEBT and above what amount an owner must approve it, so an
 #   admin — not only a stylist — must be refused.
 #   Same mechanism as TR-A/TR-B: one key added to the existing hasAny() list.
 case("TR-D1p3: WXSTAFF writes checkoutSettings → DENY","DENY",
      req("update","/tenants/whitecross/settings/settings",WXSTAFF,
          {"checkoutSettings":{"enabled":True}}),{"shopName":"Y"}),
 case("TR-D1p3: WX(admin) writes checkoutSettings → DENY (owner-only; admins run the shop)","DENY",
      req("update","/tenants/whitecross/settings/settings",WX,
          {"checkoutSettings":{"enabled":True}}),{"shopName":"Y"}),
 case("TR-D1p3: WXOWNER writes checkoutSettings → ALLOW","ALLOW",
      req("update","/tenants/whitecross/settings/settings",WXOWNER,
          {"checkoutSettings":{"enabled":True,"mode":"tr"}}),{"shopName":"Y"}),
 case("TR-D1p3: SUPER-ADMIN writes checkoutSettings → ALLOW","ALLOW",
      req("update","/tenants/whitecross/settings/settings",SUP,
          {"checkoutSettings":{"enabled":True}}),{"shopName":"Y"}),
 case("TR-D1p3: WXSTAFF raises their OWN unpaid limit → DENY (the reason this rule exists)","DENY",
      req("update","/tenants/whitecross/settings/settings",WXSTAFF,
          {"checkoutSettings":{"permissions":{"staffMayMarkUnpaid":True},
                               "methods":{"unpaid":{"staffLimit_m":99999999}}}}),{"shopName":"Y"}),
 case("TR-D1p3: WXSTAFF CREATES a settings doc carrying checkoutSettings → DENY","DENY",
      req("create","/tenants/whitecross/settings/newdoc",WXSTAFF,{"checkoutSettings":{"enabled":True}})),
 case("TR-D1p3: WXOWNER CREATES a settings doc carrying checkoutSettings → ALLOW","ALLOW",
      req("create","/tenants/whitecross/settings/newdoc",WXOWNER,{"checkoutSettings":{"enabled":True}})),
 case("TR-D1p3: HEROOWNER writes WHITECROSS checkoutSettings → DENY (cross-tenant)","DENY",
      req("update","/tenants/whitecross/settings/settings",HEROOWNER,
          {"checkoutSettings":{"enabled":True}}),{"shopName":"Y"}),
 case("TR-D1p3: UNAUTH reads the private settings doc → DENY (commission terms are not public)","DENY",
      req("get","/tenants/whitecross/settings/settings",None),
      {"checkoutSettings":{"providers":[{"id":"pos-1","commissionRatesByCount":{"3":290}}]}}),
 case("TR-D1p3: UNAUTH writes checkoutSettings → DENY","DENY",
      req("update","/tenants/whitecross/settings/settings",None,
          {"checkoutSettings":{"enabled":True}}),{"shopName":"Y"}),
 case("TR-D1p3: same-tenant STAFF READS the settings doc → still ALLOW (no read regression)","ALLOW",
      req("get","/tenants/whitecross/settings/settings",WXSTAFF),
      {"checkoutSettings":{"enabled":True}}),
 case("TR-D1p3: WXSTAFF writes a NON-checkoutSettings field → still ALLOW (no regression)","ALLOW",
      req("update","/tenants/whitecross/settings/settings",WXSTAFF,{"shopName":"X"}),{"shopName":"Y"}),
 # PAY-1 lives on the PUBLIC tenant root and is a different contract entirely —
 # unchanged by this phase, asserted here so a future edit cannot merge them.
 case("TR-D1p3: WX(admin) writes root-doc paymentSettings (PAY-1) → still ALLOW (unchanged)","ALLOW",
      req("update","/tenants/whitecross",WX,{"paymentSettings":{"mode":"deposit"}}),{"name":"WC"}),
 case("TR-D1p3: UNAUTH reads the tenant root PAY-1 mirror → still ALLOW (unchanged)","ALLOW",
      req("get","/tenants/whitecross",None),{"name":"WC","paymentSettings":{"mode":"deposit"}}),
 # packageSettings keeps its own owner-only gate, independently of the new key.
 case("TR-D1p3: WX(admin) writes packageSettings → still DENY (TR-B unchanged)","DENY",
      req("update","/tenants/whitecross/settings/settings",WX,
          {"packageSettings":{"enabled":True}}),{"shopName":"Y"}),
 case("TR-D1p3: WXOWNER writes packageSettings → still ALLOW (TR-B unchanged)","ALLOW",
      req("update","/tenants/whitecross/settings/settings",WXOWNER,
          {"packageSettings":{"enabled":True}}),{"shopName":"Y"}),
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
