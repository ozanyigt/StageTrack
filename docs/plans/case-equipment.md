# Case (çok cihazlı kutu)

**Durum:** onaylandı · Aşama 1 uygulanıyor.
**Hazırlayan:** Claude · **Tarih:** 2026-11-11 · **Dal:** `feature/venue-plan`

## İhtiyaç

İki tür kutu var:

- **Tek cihazlık case** (örn. VX2000): barkod cihazın kendisinde. **Bugünkü gibi kalır.**
- **Çok cihazlı case** (örn. bir rack: Aquilon + Watchpax 62 + mikser + UPS + kablolar):
  bunun için yeni `Case` ekipman tipi.

İstenen davranış: case'in kendi barkodu olur; içeriği seri takipli üründe **spesifik cihaz**,
adet takipli üründe **adet**tir; bir cihaz aynı anda tek case'te olabilir; case okutulunca
içindeki her şey tek seferde çıkar/döner; case projeye eklenince içerik de rezerve olur;
belgelerde case ana satır, içerik girintili; teklifte case tek satır; ağırlık = boş + içerik.

## 1) Veri modeli

**Tip:** `EquipmentType`'a yeni değer `Case = 4`. Ayrı bir bool yerine bu seçildi: kullanıcı
formda tip olarak seçiyor, Consumable/ForSale ile karşılıklı dışlayıcı, ve `EquipmentType`
kod tabanında 18 yerde geçiyor (ön yüzde 9) — kontrollü bir değişiklik. Enum tel üzerinde
metin, veritabanında int olduğu için şema değişmiyor; `EQUIPMENT_TYPES`, Excel tip
ayrıştırıcısı ve filtreler güncellenir.

**Case kuralları** (entity düzeyinde): `IsSerialized = false` zorunlu, `StockQuantity = 1`
sabit, `EquipmentUnit` eklenemez, `EquipmentLedSpec` taşıyamaz, `EquipmentRelations.Content`
kullanılamaz. Etiket mevcut altyapıyla ekipmana bağlanır (Rentman QR dahil) — yeni kod yok.

**Yeni tablo:**

```
CaseContents   Id, CompanyId, CaseEquipmentId, EquipmentId, UnitId (NULL), Quantity, SortOrder
```

- Seri takipli: `UnitId` dolu, `Quantity = 1`.
  Filtreli benzersiz indeks `(CompanyId, UnitId) WHERE IsDeleted = 0 AND UnitId IS NOT NULL`
  → bir cihaz aynı anda tek case'te.
- Adet takipli: `UnitId` null, `Quantity = n`.
- İndeks: `(CompanyId, CaseEquipmentId, SortOrder)`.

**Mevcut "İçerik" ile farkı — ikisi birlikte yaşar:**

| | `EquipmentRelations.Content` (bugünkü) | `CaseContents` (yeni) |
|---|---|---|
| Ne anlatır | **Model şablonu**: "roof sistemi 12 truss + 6 vinç ile gider" | **Fiziksel gerçek**: "FOH Rack 1'in içinde şu an TR-003 var" |
| Hedef | ekipman → ekipman + adet | ekipman → **cihaz** veya ekipman + adet |
| Kopyası | her projeye yeniden açılır | tek, fiziksel kutu |
| Durum | dokunulmuyor (setler/kitler) | yeni |

## 2) Okutma akışı

`WarehouseManager.ScanAsync` üç yeni dal alır.

**(a) Case barkodu:** `CaseScanPlan` (saf domain fonksiyonu) içerik + proje bakiyelerinden
yapılacaklar listesi üretir. Case için bir `WarehouseMovement`, **her içerik kalemi için ayrı
satır** (`Note = "FOH Rack 1 ile"`), seri takiplilerde `UnitId` dolu → cihazların İş geçmişi
dolar. Seri takipli cihazlarda `unit.CheckOut(projectId)` da çağrılır.

**(b) Çıkışta içerikten biri müsait değilse:** ön kontrol, `RequiresConfirmation` ile liste:
*"9 kalemden 1'i çıkamıyor: TR-003 (2400 Teknofest'te). Kalanla çıkalım mı?"* Onaylanırsa
çıkabilen çıkar, çıkamayan sonuçta raporlanır.

**(c) Dönüşte eksik kalem:** case okutulunca o projede dışarıda olan içerik kalemleri döner;
case'ten çıkarılmış ya da ayrı okutulmuş olanlara dokunulmaz. Sonuç: *"8 kalem döndü, 1 kalem
(TR-003) case'te değil — hâlâ dışarıda."* Case'i "hepsi dönene kadar kapatma" kuralı yok.

**(d) Case içindeki cihaz tek başına okutulursa:** `ScanWarning.InsideCase` + case adı ile
onay istenir; onaylanırsa `CaseContents` satırı silinir (`Note = "FOH Rack 1'den çıkarıldı"`)
ve okutma normal akışla sürer.

Yeni kodlar ve üç dilde çeviri: `InsideCase`, `CaseContentUnavailable`, `CaseReturnIncomplete`.

## 3) Planlama / rezervasyon

Case projeye eklenince `ProjectManager.AddEquipmentAsync` **mevcut `project.SetContent(...)`**
yolunu kullanır; tek fark içeriğin `EquipmentRelations` yerine `CaseContents`'ten gelmesi
(cihaz satırları ekipman + adet olarak toplanır: proje satırı cihaz tutmaz, *hangi* cihazın
gideceğini fiziksel case belirler).

Sonuç: **`AvailabilityManager` değişmeden çalışır** — içerik gerçek proje satırı olduğu için
tepe hesabına giriyor; aynı cihaz hem case ile A'da hem tek başına B'de planlanırsa stok 1 /
tepe 2 → eksik uyarısı. Üstüne cihaz düzeyinde açık uyarı: *"TR-003, FOH Rack 1 case'inde; o
case 2400 Teknofest'te planlı."*

Stok: içerikteki cihazlar kendi ekipmanlarının stoğunda sayılmaya devam eder, konum ve durum
değişmez; cihaz listesinde/detayında **"FOH Rack 1'inde"** rozeti (türetilir, yeni kolon yok).

**İçerik değişince açık projeler (onaylı ek madde):** case'in içeriği sonradan değişirse
(cihaz eklendi/çıkarıldı, tek okutmada case'ten düştü), case'in planlı olduğu **açık**
projelerdeki (`Draft`, `Pending`, `Confirmed`, `Prepped`) içerik satırları otomatik güncellenir;
`OnLocation`, `Returned`, `Cancelled` projelere dokunulmaz. Kullanıcıya *"Bu değişiklik 2 açık
projeyi etkiledi: 2400, 2396"* bilgisi gösterilir. Aşama 3'te, kendi testiyle.

## 4) Arayüz

- **Ekipman ekleme formu:** tipte "Case". Seçilince seri no anahtarı ve stok adedi kapanır
  (sabit 1), **Boş ağırlık** öne çıkar.
- **Case detay sayfası:** aynı sayfa, **"Seri numaraları" sekmesi yok**. "İçerik" sekmesi
  fiziksel içerik düzenleyicisi olur: üstte arama + ekle, altta liste. Seri takipli ürün
  eklenirken **cihaz seçici** açılır; her cihazın durumu yazar (boşta / 2400'de / FOH Rack
  2'de), uygun olmayan seçilemez. Başlıkta canlı özet: **"9 kalem · boş 18 kg · dolu 63 kg"**.
- **Okutma ekranı:** case okutulunca tek **grup kartı** — üstte case adı ve ilerleme (9/9),
  altında kalemler işaretlenir; hatalı/eksik olanlar kırmızı kalır.
- **Belgeler:** okutma föyü, paketleme listesi ve irsaliyede case ana satır, içerik girintili
  (mevcut `ParentLineId` render yolu).
- **Teklif:** case tek satır, kendi fiyatıyla; **içerik teklifte görünmez**.
- **Depo panosu:** değişmiyor.

## 5) Ağırlık

`Equipment.EmptyWeightKg` (var) + içerik toplamı. Domain'de saf fonksiyon
`CaseWeight.Of(case, contents)`; irsaliye, föy ve lojistik bunu okur. Case'in dolu ağırlığı
türetilir, elle girilmez.

## 6) Excel ve etiketler

- **Export:** tip sütununda "Case"; opsiyonel ikinci sayfa "Case içerikleri" (case kodu,
  ekipman kodu, cihaz iç ref, adet).
- **Import:** 1. fazda yalnız case'in kendisi; içerik importu kapsam dışı (düz tabloda cihaz
  eşlemesi güvenilir değil).
- **Etiketler:** değişiklik yok; barkod ekipman düzeyinde, Rentman QR dahil.

## 7) Panelyze / `IsCaseTracked` ile karışmaması

| | `LedPanelSpec.IsCaseTracked` | `EquipmentType.Case` |
|---|---|---|
| Ne | **Tek tip** panelin case başına seri numarası | **Karışık içerikli** fiziksel kutu |
| Kayıt | 1 ekipman = N dolly, her dolly bir `EquipmentUnit` | 1 ekipman = 1 kutu, içeriği `CaseContents` |
| Dönüşüm | panel ↔ case çarpanı (`CasePanelCount`) | yok, içerik kalem kalem gerçek |

**Doğrulama:** `Case` tipli ekipman `EquipmentLedSpec` taşıyamaz; `IsCaseTracked` yalnız
`Physical` tipli panelde açılabilir. Arayüzde LED tarafı "seri numarası kutuya verilir", bu
özellik "Case (kutu)" diye anılır. ROE zemin dolly'si teknik olarak bu tiple de modellenebilir
ama önerilmez (40 özdeş tile için 4 ekipman + 40 içerik satırı).

## 8) Migration ve testler

**Migration `CaseContents`:** tek tablo + iki indeks (biri filtreli benzersiz). `EquipmentType`
int kolonu olduğu için şema değişmez. `Initial`'a dokunulmaz.

Testler: case okut → case + içerik hareketleri ve cihaz durumları · dönüş · içerikten biri
başka projede (onay, kısmi çıkış, rapor) · dönüşte eksik kalem · tek cihaz okutma uyarısı ve
case'ten düşme · aynı cihaz iki projede çakışma · cihaz ikinci case'e eklenemez · Case tipinde
cihaz/LED spec/`IsSerialized` reddi · ağırlık · teklifte tek satır · **içerik değişince açık
projelerin güncellenmesi, kapalı projelerin korunması**.

## 9) Kararlar (onaylandı)

1. **Case içinde case: hayır** (v1).
2. Case çıkınca içerik **"projede" görünür** (cihaz `CurrentProjectId` alır).
3. **Fiyat elle**; "içerik toplamı: ₺X" bilgi olarak gösterilir.
4. **Arşivleme:** içerik boşaltılır, cihazlar serbest kalır, liste arşiv kaydında not olarak
   saklanır — **ama case dışarıdayken (projede/sahada) arşivlenemez**.
5. **Teklif:** case tek satır; **içerik teklifte görünmez**. İrsaliye, paketleme listesi ve
   okutma föyünde girintili görünür.

## 10) Aşamalar

| Aşama | Kapsam | Tahmin |
|---|---|---|
| **1** | Veri modeli: `EquipmentType.Case`, `CaseContents`, migration, entity kuralları; ekipman formu + case detay + içerik düzenleyici (cihaz seçici); ağırlık | 1,5 gün |
| **2** | Okutma: case çıkış/dönüş, kısmi durumlar, tek cihaz uyarısı, okutma ekranı grup kartı | 1,5 gün |
| **3** | Planlama/rezervasyon: içerik genişletme, cihaz düzeyinde çakışma uyarısı, "X case'inde" rozeti, **içerik değişince açık projelerin güncellenmesi** | 1 gün |
| **4** | Belgeler: föy/paketleme/irsaliye girintisi, teklif satırı, Excel export | 0,5–1 gün |

Toplam ~4,5–5 gün. Her aşama kendi commit'i; aşama sonunda beşli kontrol + Playwright.
