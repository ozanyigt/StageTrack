# Case bazlı seri takipli LED paneller

**Durum:** beklemede — plan onaylandı, uygulama ertelendi. Hiç kod yazılmadı.
**Hazırlayan:** Claude · **Tarih:** 2026-11-10 · **Dal:** `feature/venue-plan`

## Gerçek durum

STARAS'ın Rentman'inde case'li LED'lerde (örn. floor paneller) seri numarası **case'e** verilir:
bir cihaz kaydı = bir case = `CasePanelCount` kadar panel. Demo verideki `Led-047`
(LED FLOOR 4.7MM, ROE Black Marble) bunun örneği — 4 cihaz, her biri 10 panellik bir dolly
(`FLOOR 321-330` gibi iç referanslar). `Led-026` / `Led-045` ise panel başına seri takipli.
İki yapı yan yana yaşayacak.

## Mimari karar

Depo/rezervasyon/okutma/teklif tarafında **birim case'tir ve değişmez**. Stok sayımı,
`AvailabilityManager`, okutma, paketleme listesi hep case sayar. Panele çevirme yalnızca
**Design modülünün sınırında** yapılır.

## 1) Alan ve migration

`LedPanelSpec.IsCaseTracked` (bool, varsayılan `false`) — "bu panelde bir cihaz kaydı bir
case'tir". Ad, mevcut sözleşmeyle aynı ailede (`IsSerialized`, `HasExclusiveProcessors`).
Alternatif: `SerialPerCase`.

Kural entity'de, `SetTransport` ile birlikte doğrulanır:

```
IsCaseTracked == true  →  CasePanelCount > 0 zorunlu
                          değilse BusinessException(StageTrackErrorCodes.LedCaseNeedsPanelCount)
```

Yeni hata kodu: `LedCaseNeedsPanelCount = "Led.CaseNeedsPanelCount"`, çevirisi tr/en/ar.

**Migration:** `EquipmentLedSpecs` tablosuna tek `AddColumn<bool>(defaultValue: false)`.
Katkı niteliğinde; EF drop+create üretirse rename'e çevrilecek. `Initial` migrasyonuna
dokunulmayacak. Önerilen ad: `PanelCaseTracking`.

## 2) Dönüşüm: iki saf metot, üç çağrı noktası

Kural tek yerde, entity üzerinde:

```
LedPanelSpec.PanelsFromDevices(int devices) => IsCaseTracked ? devices * CasePanelCount : devices
LedPanelSpec.DevicesForPanels(int panels)   => IsCaseTracked ? ceil(panels / CasePanelCount) : panels
```

| # | Nokta | Dosya | Değişiklik |
|---|---|---|---|
| a1 | Panel kataloğu stoğu | `Application/Design/LedInventoryAppService.cs` (`Fill`) | `dto.Stock = spec.PanelsFromDevices(cihazSayısı)` |
| a2 | Stok durumu | `Application/Design/StageAndStockAppServices.cs` | konum başına stok × `CasePanelCount`; "kullanılan" panel cinsinden kalır |
| b | Taslak → iş | `Application/Design/DraftToJobAppService.cs` | panel adedi → `DevicesForPanels` ile case; proje satırına **case** yazılır |
| b2 | Önizleme | `Application.Contracts/Design/DraftToJobDtos.cs`, `pages/draft/DraftToJobModal.tsx` | `DraftToJobLineDto`'ya `PanelsWanted` + `PanelsPerUnit`; satır "45 panel → 5 case (50 panel kapasitesi)" |
| c | Lojistik | **değişiklik yok** | aşağıya bak |
| d | Ekipman LED sekmesi | `pages/equipment/EquipmentLedTab.tsx`, `api/designTypes.ts`, `Design/LedInventoryDtos.cs` | kutu + kısa açıklama, 2 i18n anahtarı × 3 dil |
| e | Demo veri | `Domain/Data/DesignDemoData.cs`, `DemoDataSeeder.cs` | `Led-047` için `true`, idempotent (ağırlık düzeltmesiyle aynı desen) |

**Repository'ler değişmez.** `GetStockQuantitiesAsync` depo tarafı ve `AvailabilityManager`
tarafından da kullanılıyor; çarpma yalnız Design servisinde yapılacak.
`GetStockByLocationAsync`'in tek tüketicisi stok durumu servisi.

### Lojistik neden değişmiyor

`CaseGroup.For(..., panels, perCase)` → `SplitPanels(panels, perCase)` = `ceil(panels / perCase)`.
Panel sayısı `cihaz × perCase` olduğundan sonuç birebir cihaz sayısıdır; yarım case kuralı
zaten yerinde. `StageTrack.Design/Transport/**` dosyalarına dokunulmayacak.

## 3) Case/panel karışıklığı taraması

| Yer | Bugünkü davranış | Karar |
|---|---|---|
| Pixel Map stok uyarısı | katalog DTO'sundaki `stock` → `core/adapter.ts` `Adet` | a1 ile düzelir, `core/adapter.ts` dokunulmaz |
| Stok Durumu | konum başına cihaz sayısı | a2 ile düzelir |
| 3D sahne ağırlığı | panel × `Equipment.WeightKg` | sorun yok (ağırlık artık tile başına) |
| Lojistik | `ceil(panel / perCase)` | sorun yok |
| LED envanteri tablosu, İşlemci sayfası, dal tasarım tabloları | aynı DTO alanı | a1 ile tek noktadan düzelir |
| Proje eksik/müsaitlik | case | değişmez (depo tarafı) |
| Teklif satırı | `Led-047` günlük fiyatı case fiyatı | aktarım case yazdığı için tutarlı |
| Excel dışa aktarım | LED kataloğu için ayrı export yok | etkilenmiyor |

## 4) Ağırlık / ölçü çakışması (uygulamadan önce karar gerekiyor)

Ağırlık düzeltmesinden sonra (`c77acd0`) `Led-047`'nin ekipman kaydı **karışık birim**
taşıyor — bir kısmı tile'ı, bir kısmı dolly'yi anlatıyor:

| Alan | Değer | Neyi anlatıyor |
|---|---|---|
| `Equipment.WeightKg` | 10,5 kg | **bir tile** (düzeltildi) |
| `Equipment.LengthCm × WidthCm × HeightCm` | 80 × 133 × 99 cm | **dolly** |
| `Equipment.VolumeM3` | 1,053 m³ | ölçülerden türediği için **dolly** |
| `Equipment.PowerW` | 2.000 W | **on tile'ın toplamı** (10 × 150 W + pay) |
| `Equipment.CurrentA` | 9 A | 2.000 W / 220 V → **dolly** |
| `Equipment.PackedPer` | 10 | case'teki panel |
| `Spec.CasePanelCount` | 10 | case'teki panel (**aynı bilgi ikinci kez**) |
| `Spec.CaseDimensionsCm` | 60 × 55 × 105 cm | case — **ekipman ölçüsüyle çelişiyor** |
| `Spec.CaseWeightKg` | 175 kg | case |
| `Spec.PowerMaxW` | 150 W | bir tile |

Üç ayrı sorun:

1. **Birim karışıklığı.** Ağırlık tile, ölçü/hacim/güç/akım dolly. 3D sahne ve hesap
   motoru `Spec` alanlarını okuduğu için bugün doğru çalışıyor; ama ekipman kartındaki
   ölçü/güç, irsaliye ve araç hacmi hesapları `Equipment` alanlarını okur. Case bazlı
   takip açıldığında "ekipman kaydının fiziksel alanları neyi anlatır" sorusunun tek bir
   cevabı olmalı.
2. **İki yerde aynı bilgi.** `Equipment.PackedPer` ile `Spec.CasePanelCount`. `Led-047`'de
   ikisi de 10 (uyumlu), ama `Led-045`'te **PackedPer = 1, CasePanelCount = 6** — şimdiden
   çelişiyorlar. Hangisinin doğru kaynak olduğu kararlaştırılmalı.
3. **İki ayrı case ölçüsü.** `Equipment` 80 × 133 × 99, `Spec.CaseDimensionsCm`
   60 × 55 × 105. Lojistik `Spec`'i kullanıyor, ekipman kartı `Equipment`'ı gösteriyor.

Seçenekler:

- **A (önerilen).** Kural: `Equipment` fiziksel alanları **daima depo biriminin** (yani
  case bazlı takipte case'in) ölçüsüdür; `Spec` alanları daima **bir panelin**. O zaman
  `Led-047`'nin ağırlığı 175 kg'a (dolly) geri döner, tile ağırlığı spec'e yeni bir alan
  olarak (`PanelWeightKg`) taşınır. Tutarlı ama yeni alan + 3D/hesap tarafında okuma
  değişikliği demek.
- **B.** Kural: `Equipment` daima **bir panelin**; case bilgisi tamamen spec'te. O zaman
  `Led-047`'nin ölçüsü 50 × 50 × 3,5 cm, gücü 150 W, akımı boş olur; dolly'yi yalnız spec
  anlatır. Bugünkü ağırlık düzeltmesiyle aynı yönde, depo kartında "bir tile" görünür.
- **C.** Bugünkü karışık hâli bırak, yalnız `Led-045`'in `PackedPer = 1` tutarsızlığını
  düzelt. En az iş, ama soru açık kalır.

`PackedPer` / `CasePanelCount` ikiliği de aynı kararla kapanmalı: biri diğerinden
türetilsin ya da LED paneller için `CasePanelCount` tek kaynak sayılsın.

## 5) Test planı

**Domain.Tests**
- `IsCaseTracked = true` + `CasePanelCount` null/0 → `LedCaseNeedsPanelCount`
- `IsCaseTracked = true` + 10 → geçerli
- `PanelsFromDevices(4) = 40`, `DevicesForPanels(45) = 5`, `DevicesForPanels(40) = 4`
- `IsCaseTracked = false` → iki metot da birebir (panel bazlı davranış değişmedi)

**Application.Tests**
- `Led-047`: 4 cihaz → 40 panel stok
- `Led-047`: 45 panellik taslak → 5 case, eksik uyarısı (40 panel var, 45 isteniyor)
- Aktarım: 60 panel `Led-047` → proje satırına **6 case**
- `Led-026`: 60 panel → 60 satır (regresyon)

**Değişmemesi gerekenler:** `StageTrack.Design.Tests` içindeki 118 hesap testi
(`Calculation/**`, `Transport/**` dosyalarına dokunulmuyor).

## 6) Dokunulmayacak yerler

- `frontend/src/pages/led/core/**` (Panelyze'dan portlanan çizim/kablolama/3D kodu)
- `backend/src/StageTrack.Design/Calculation/**` ve `Transport/**` (hesap motoru)
- Depo, rezervasyon, okutma, paketleme, teklif akışı ve `ProjectManager` /
  `AvailabilityManager` / `InventoryAppServices`
- `Migrations/Initial`

Arkadaşın orijinal dosyalarından yalnız ikisi, ikisi de katkı niteliğinde:
`StageTrackErrorCodes.cs` (bir sabit) ve `locales/{tr,en,ar}.json` (yeni anahtarlar).
