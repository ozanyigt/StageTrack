# Değişiklik geçmişi (Rentman "History log")

**Durum:** beklemede — plan hazır, uygulama ertelendi. Hiç kod yazılmadı.
**Hazırlayan:** Claude · **Tarih:** 2026-11-11 · **Dal:** `feature/venue-plan`
**İlgili:** Aşama 1 (cihaz "İş geçmişi" sekmesi) uygulandı; bu dosya Aşama 2'yi anlatır.

## İstenen

Ekipman sayfasında "Değişiklik geçmişi" sekmesi:

- Solda **kayıtlar** listesi: zaman + kaydeden kullanıcı (bir kaydetme işlemi = bir satır).
- Sağda seçilen kaydın **değişiklikleri**, gruplu: Genel (ekipmanın kendisi), Seri numaraları
  (cihazlar), LED teknik verisi, İçerik/Aksesuar/Alternatif, Tedarikçiler, Etiketler.
- Her satır: tür (Eklendi/Değişti/Silindi), kayıt adı (örn. TR-001), alan adı (çevrilmiş,
  okunur), eski değer, yeni değer.

Cihaz sayfasında da aynı yapı, yalnız o cihazın değişiklikleri.

## 1) Değişiklikler nasıl yakalanır

**Tek nokta: `StageTrackDbContext.SaveChangesAsync` içinde `ChangeTracker`.** Her entity'ye elle
kod yazılmaz. Mevcut `SaveChanges` override'ı zaten denetim alanlarını ve soft delete'i orada
işliyor; aynı yere bir `ChangeSetRecorder` eklenir.

- `ChangeTracker.Entries()` → `Added` / `Modified` / `Deleted`.
- **Dahil entity'ler** (ekipmanın geçmişine girenler): `Equipment`, `EquipmentUnit`,
  `EquipmentLabel`, `EquipmentRelation`, `EquipmentSupplier`, `EquipmentLedSpec` (üç alt tipi),
  `UnitInspection`, `Repair`.
- **Hariç**: `WarehouseMovement` (kendi kaydı var), `ChangeSet` / `ChangeEntry` / `AuditLog`
  (kendini kaydetmesin), `Attachment` içeriği (yalnız dosya adı), ve ilk turda tüm diğer
  modüller (proje, teklif, müşteri) — **kapsam ekipman + cihaz**.
- **Hariç alanlar**: `LastModificationTime`, `LastModifierId`, `CreationTime`, `CreatorId`,
  `IsDeleted`, `DeletionTime`, `CompanyId`, `Id` ve gerçekten değişmemiş alanlar
  (`original == current`).
- Değişiklik yoksa hiç `ChangeSet` yazılmaz.

## 2) Tablo tasarımı

Mevcut `AuditLogs` **genişletilmez**: o, "kim neyi sildi" biçiminde tek satırlık bir iz ve
Ayarlar → Denetim kaydı ekranı onu okuyor. Değişiklik geçmişi alan bazlı ve çok satırlı;
ikisini birleştirmek her ikisini de bozar. **İki yeni tablo:**

```
ChangeSets     Id, CompanyId, At, UserId, UserName, ImpersonatorId, ImpersonatorName,
               Source (Ui | Import | System), EquipmentId (NULL olabilir), UnitId (NULL olabilir)

ChangeEntries  Id, ChangeSetId, Group (General|Units|Led|Relations|Suppliers|Labels),
               EntityType, EntityId, EntityLabel ("TR-001"), Kind (Added|Modified|Removed),
               Field, OldValue, NewValue, IsPrice (bool)
```

**Ekipmana bağlama:** `ChangeSet.EquipmentId` kaydetme anında hesaplanır — değişen entity
ekipmanın kendisiyse kendi id'si; cihaz / etiket / spec / ilişki / tedarikçi ise sahibinin
`EquipmentId`'si. Böylece ekipman sayfası `WHERE EquipmentId = @id`, cihaz sayfası
`WHERE UnitId = @id` ile okur ve cihaz değişiklikleri ekipmanın geçmişinde de görünür.

## 3) Impersonation

`ICurrentUser` hem `Id` hem `ImpersonatorId` taşıyor. `ChangeSet` ikisini de yazar; arayüz
"Demo Yönetici (Platform Yöneticisi adına)" biçiminde gösterir. Bir i18n anahtarı eklenir.

## 4) Fiyat alanları

`IsPrice` bayrağı satır yazılırken konur (`RentalPrice`, `PurchasePrice`, `ContentPriceTotal`…).
`StageTrack.Prices` yetkisi olmayan kullanıcıya **AppService** eski/yeni değeri `null`'layıp
satırı "•••" olarak gönderir: satırın varlığı görünür, tutar görünmez. Filtre sunucuda.

## 5) Okunur değerler

- **Enum** → sabit adı saklanır (`"ForSale"`), arayüz `t('enums.…')` ile çevirir.
- **Tarih** → ISO saklanır, arayüz yerel biçimde gösterir.
- **Guid referans** → kaydetme anında adı çözülür: `FolderId` → `"VIDEO / Led Screen"`,
  `SupplierId` → `"Işık Market Ltd."`, `StockLocationId` → `"GÜNEŞLİ"`. Çözüm
  `ChangeSetRecorder` içinde ilgili repository'lerden toplu (tek sorgu) yapılır; çözülemezse
  Guid yazılır.
- **Alan adı** → `Field` teknik adı saklar (`RentalPrice`), arayüz `t('fields.RentalPrice')`
  ile çevirir; anahtar yoksa teknik adı gösterir. Üç dile ~60 anahtar.

## 6) Toplu işlemler

Excel import ve toplu taşıma/rol atama tek `SaveChanges` içinde döndüğü için **tek `ChangeSet`**
olur (`Source = Import`), içinde N `ChangeEntry`. `ChangeSet` başına 500 satır sınırı; aşılırsa
özet satırı yazılır ("142 ekipman güncellendi"), detay şişmez.

## 7) Performans ve büyüme

- İndeksler: `ChangeSets(CompanyId, EquipmentId, At DESC)`,
  `ChangeSets(CompanyId, UnitId, At DESC)`, `ChangeEntries(ChangeSetId)`.
- Sol listede sayfalama (20'lik); sağ panel seçilen kaydı ayrı sorguyla çeker.
- Yazma maliyeti: değişiklik yoksa sıfır satır; tipik bir ekipman kaydetmesi 1 + 3–10 satır.
- Saklama süresi: ileride "N aydan eski kayıtları temizle" gerekebilir — şimdilik yalnız not.

## 8) Migration ve test planı

Yeni migration `ChangeLog` (iki tablo + üç indeks). `Initial`'a dokunulmaz.

Testler:
- değişmeyen alan satır üretmez
- hariç alan listesi (LastModificationTime vb. hiç görünmez)
- Guid → ad çözümü
- fiyat maskeleme (yetkisiz kullanıcıya değer gitmez)
- impersonation adı
- import tek `ChangeSet`
- cihaz değişikliğinin ekipmanın geçmişinde görünmesi

## 9) Mevcut denetim kaydıyla ilişki

Bugün `AuditLogManager` **yalnız ekipman silmede** satır yazıyor ve Ayarlar → Denetim kaydı
ekranı onu listeliyor. Öneri: ikisi birlikte kalsın — denetim kaydı güvenlik izleri için
(kim sildi, kim giriş yaptı), değişiklik geçmişi alan bazlı ürün geçmişi için. İkinci turda
`AuditLog`'un `ChangeSet`'ten beslenmesi konuşulabilir; bu planda dokunulmuyor.

## Tahmin

Backend ~1 gün (recorder + çözümleyici + testler), ön yüz ~yarım gün (iki panel: ekipman ve
cihaz). Toplam ~1,5 gün.
