# StageTrack — Depo takip ve teklif sistemi (demo)

Rentman'in yerine geçecek, Türkçe/İngilizce/Arapça, teknik prodüksiyon firmaları için depo takip ve teklif sistemi.
Analiz dokümanı: https://claude.ai/code/artifact/1d4dae89-65d7-4566-b08a-5759db2bbae4

## Çalıştırma

Gereken: .NET 10 SDK, Node 20+, SQL Server LocalDB (Visual Studio ile gelir).

```
start-demo.cmd            # API + web'i ayrı pencerelerde açar
```

veya elle:

```
cd backend/src/StageTrack.HttpApi.Host && dotnet run      # http://localhost:5080  (API dokümanı: /scalar)
cd frontend && npm install && npm run dev                 # http://localhost:5180
```

İlk açılışta veritabanı oluşturulur ve demo verisi yüklenir. Demoyu sıfırlamak için `reset-demo-db.cmd`.

| Kullanıcı | Şifre | Rol |
| --- | --- | --- |
| admin | Admin123! | Tüm yetkiler, TR + Dubai şirketleri |
| depo | Depo123! | Depo: okutma, etiket bağlama |
| satis | Satis123! | Proje, müşteri, teklif |
| dubai | Dubai123! | Yalnızca Dubai şirketi |

### Telefonla okutma

Telefon kamerası HTTPS ister. Aynı Wi-Fi'de: `cd frontend && npm run dev:lan`, telefonda `https://<bilgisayar-ip>:5180`
açın ve sertifika uyarısını bir kez kabul edin. iPhone'da kamera okuması için QR çözücü (zxing wasm) ilk kullanımda
internetten indirilir.

### El okuyucu (USB / Bluetooth)

El okuyucular klavye gibi çalışır. Rentman QR'ı JSON taşıdığı için (`{"ID":"19483","cmpID":16,"isCase":0}`) okuyucunun
klavye dili önemlidir: okuyucu **US** klavyeye, Windows **Türkçe Q**'ya ayarlıysa metin `ĞİIDİŞİ19483İ…Ü` gibi bozulur.
Sistem bu bozulmayı tanıyıp düzeltir; yine de okuyucunun klavye dilini bilgisayarla aynı yapmak en sağlıklısıdır
(okuyucunun kılavuzundaki "Keyboard language: Turkish Q" barkodu).

### Rentman etiketleri

| Okutulan | Saklanan kod |
| --- | --- |
| `{"ID":"19483","cmpID":16,"isCase":0}` (kamera) | `RM:16:S:19483` |
| `ĞİIDİŞİ19483İöİcmpIDİŞ16öİısCaseİŞ0Ü` (US okuyucu + TR-Q Windows) | `RM:16:S:19483` |
| `{"ID":"512","cmpID":16,"isCase":1}` (case etiketi) | `RM:16:C:512` |

`cmpID` Rentman çalışma alanıdır (Staras TR = 16). Başka bir şirketimize ait etiket okutulursa "bu etiket X şirketine ait"
uyarısı verilir. Cihaz aramasında Rentman numarası (`19483`) ile de aranabilir. Elle test için kod `RM:16:S:900170`
biçiminde yazılabilir.

## Demo senaryosu (≈20 dk)

1. **Gösterge paneli** → 2400 Teknofest'te eksik uyarısı (Sharpy Beam'lerin 14'ü UNIQ Hall sabit kurulumunda).
2. **Depo panosu** → Rentman'deki gibi Onaylı / Hazırlandı / Sahada / Bugün dönecek / Gecikmiş kolonları.
3. **Okutma** → 2381 Ella Event'i seçin, `RM:16:S:900170` yazın (VID-042 çıkışı, paketleme listesi canlı güncellenir).
   `RM:16:S:900000` → "K3 001 zaten 2039 UNIQ HALL projesinde" uyarısı. Demo etiketlerinin QR'ları gerçek Rentman
   formatındadır: Seri numaraları ekranında QR simgesiyle ekranda gösterip telefonla okutabilirsiniz.
4. **Gerçek Rentman etiketi** → G-73 case'indeki "LED FLOOR 4.7MM 321-330" etiketini okutun: sistem tanımaz,
   "Etiketi cihaza bağla" penceresi açılır → Led-047 LED FLOOR / **FLOOR 321-330** (etiketsiz) seçip bağlayın → okutma
   otomatik tekrarlanır ve 2381'in paketleme listesinde LED FLOOR 1/2 olur. Aynı etiket el okuyucuyla da tanınır.
   (Diğer etiketsiz cihazlar: OPTOMA 6K VID301 005/006.)
5. **Teklif** → 2400 projesinden "Teklif oluştur": katalog fiyatları + gün çarpanı; personel/nakliye ekleyin,
   iskonto ve KDV değiştirin, Yazdır/PDF.
6. **Ayarlar → Gün çarpanları** → firmanın kendi çarpan tablosunu ekleme/çıkarma, önizleme.
7. Sağ üstten dil **Arapça** → tüm arayüz sağdan sola; şirket seçiciden **Dubai** (AED, %5 KDV).
8. **Ayarlar → Roller ve yetkiler** → yeni rol (örn. "Muhasebe"), yetki ağacından yalnızca Teklifler'i işaretleyin.
   Alt yetki işaretlenince üstü de işaretlenir; Yönetici rolü kilitlidir.
9. **Ayarlar → Kullanıcılar** → yeni kullanıcı, rol ve şirket atama; Depo Sorumlusu satırında
   **"Bu kullanıcı olarak gir"** → menü anında daralır, üstte sarı bant çıkar → "Hesabıma dön".

## Yetkilendirme

- Yetkiler `StageTrackPermissions.Groups` içinde gruplu ve üst-alt ilişkili tanımlı (ABP PermissionDefinitionProvider karşılığı).
  Her endpoint `[Authorize(<yetki adı>)]` taşır; menü, sayfa ve butonlar aynı adlarla gizlenir.
- Yerleşik **admin** rolü (`IsStatic`) her zaman tüm yetkilere sahiptir, değiştirilemez/silinemez; sonradan eklenen
  yetkiler de otomatik gelir. Böylece kimse yönetim ekranlarına erişimi kaybetmez.
- **Kullanıcı simülasyonu (impersonation):** `StageTrack.Identity.Users.Impersonate` yetkisi gerekir. Token hem hedef
  kullanıcıyı hem yöneticiyi (`impersonator_id`) taşır; zincirleme simülasyon, kendine ve pasif kullanıcıya simülasyon
  engellidir. Başlangıç/bitiş sunucu loguna yazılır.
- Yönetici yalnızca çalıştığı şirketin kullanıcılarını görür ve yalnızca kendi erişebildiği şirketleri atayabilir.
- Şifre kuralı: en az 8 karakter, harf ve rakam.

Ekranda QR göstermek için: Ekipman → bir cihaz satırında QR simgesi (yazdırılabilir).

## Mimari

ABP Framework'ün katman bağımlılıkları, ABP paketleri olmadan:

```
Domain.Shared  ← enum, sabit, hata kodu, yetki adları, backend çeviri JSON'ları
Domain         ← entity'ler, repository arayüzleri, iş kuralları (…Manager sınıfları), demo seed
Application.Contracts ← DTO'lar, IAppService arayüzleri
Application    ← ince AppService'ler (Manager + repository çağırır, DTO'ya çevirir)
EntityFrameworkCore ← DbContext, konfigürasyonlar, LINQ sorgularının tamamı (repository'ler), migration
HttpApi        ← ince controller'lar, yetki = permission adı
HttpApi.Host   ← JWT, permission policy, X-Company-Id doğrulama, istek başına unit of work, hata/çeviri
```

Kurallar: iş mantığı Manager'da, LINQ yalnızca EF Core repository'lerinde, AppService ince.
Çok şirketlilik: `IMultiCompany` + global query filter; soft delete: `ISoftDelete`.

**Rentman etiketleri:** `EquipmentLabel` tablosu okutulan değeri (`RawValue`) ve normalize edilmiş kodu (`Code`) tutar;
bir cihaza birden fazla etiket (eski Rentman QR, yeni QR, ileride RFID) bağlanabilir. URL içeren etiketlerden kod
ayıklanır (`LabelManager.Normalize`).

**Gün çarpanı:** `RentalFactorProfile` adımları (gün → çarpan) + ek gün çarpanı; tanımsız günlerde önceki adım +
ek gün × çarpan, bir sonraki adımı geçmez. Teklif, çarpanı ve fiyatları kopyalar; sonradan yapılan değişiklikler
gönderilmiş teklifi etkilemez.

**Çeviri:** önyüz `frontend/src/locales/{tr,en,ar}.json`, backend hata mesajları
`backend/src/StageTrack.Domain.Shared/Localization/Resources/*.json`. `npm run check:i18n` üç dilin aynı anahtarlara
sahip olduğunu ve koddaki her anahtarın ve her backend hata kodunun çevirisi olduğunu denetler.

## Demo kapsamı dışında (sonraki fazlar)

e-İrsaliye / e-Fatura, ekip planlama, bakım/muayene ekranları, alt kiralama, kombinasyon (case) yönetimi,
Rentman'den otomatik veri aktarımı (API/Excel), RFID.

Yetkilendirmede asıl projeye kalanlar: şirket bazlı rol, kullanıcıya özel yetki, denetim kaydı (audit log, simülasyonda
işlemi asıl yapanın kaydı), hatalı şifrede hesap kilitleme, yenileme token'ı / çerez tabanlı oturum, önyüz yetki
sabitlerinin backend'den üretilmesi.
"# StageTrack" 
