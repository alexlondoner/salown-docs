# PROMPTS.md

İşe yarayan Claude Code prompt template'leri. Yeni bir prompt çalışırsa buraya ekle.

---

## staff_app_fixes

Salown Staff App'te birden fazla bağımsız bug'ı tek seferde fix etmek için.

```
salown-app/src/ altındaki Staff App dosyalarını oku.
Şu bug'ları sırayla fix et — her fix'ten sonra değiştirilen satırları rapor et, sonrakine geç:

1. [bug açıklaması]
2. [bug açıklaması]
...

Kural: bir bug'ı fix ederken başka hiçbir şeye dokunma.
```

---

## merge_hardening

salown-app ve whitecross-site'daki aynı mantığı senkronda tutmak için.

```
[dosya adı] içindeki [fonksiyon adı]'nı oku.
Aynı mantığın whitecross-site'daki karşılığı [dosya:satır].
İkisi arasındaki farkları listele.
Whitecross versiyonunu salown-app versiyonuyla eşleştir — sadece logic farkları, style değil.
Değişen satırları önce göster, onay bekle.
```

---

_Yeni prompt eklemek için: başlık + kullanım durumu + template._
