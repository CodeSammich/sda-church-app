/**
 * Brooklyn-specific printed bulletin presentation.
 *
 * The data join remains shared with Queens, but the Brooklyn fellowship has a
 * different cover and service flow. Keeping its cover copy here prevents a
 * location-specific change from changing the Queens regular reference.
 */

var PRINTED_BROOKLYN_BULLETIN_CONFIG = Object.freeze({
  titleEnglish: 'New York Chinese SDA Church — Brooklyn Fellowship',
  titleChinese: '紐約華人基督復臨安息日教會——布魯克林團契',
  addressEnglish: '5318 4th Avenue, Brooklyn, NY 11220',
  addressChinese: '5318 4th Avenue, Brooklyn, NY 11220',
  serviceEnglish: 'Brooklyn Service | Saturdays 10:30 AM',
  serviceChinese: '布魯克林安息日聚會 | 每週六上午 10:30',
});

function renderPrintedBrooklynCoverPanel_(cell, bulletin, format) {
  cell.setPaddingLeft(0);
  cell.setPaddingRight(0);
  appendPrintedBulletinLogo_(cell);
  appendPanelHeading_(
    cell,
    printedBilingualText_(
      PRINTED_BROOKLYN_BULLETIN_CONFIG.titleEnglish,
      PRINTED_BROOKLYN_BULLETIN_CONFIG.titleChinese,
    ),
    printedBilingualText_(
      PRINTED_BROOKLYN_BULLETIN_CONFIG.addressEnglish,
      PRINTED_BROOKLYN_BULLETIN_CONFIG.addressChinese,
    ),
  );
  appendCenteredText_(cell, formatDateForPrint_(bulletin.date), 9, true);
  appendPrintedBulletinCoverImage_(cell, format);
  appendSharedCoverContactLines_(cell, [
    {
      text:
        PRINTED_BROOKLYN_BULLETIN_CONFIG.serviceChinese +
        '\n' +
        PRINTED_BROOKLYN_BULLETIN_CONFIG.serviceEnglish,
      bold: true,
    },
    { text: '5318 4th Avenue', italic: true },
    { text: 'Brooklyn, NY 11220', italic: true },
  ]);
  appendSpacer_(cell);
  appendSharedCoverContactLines_(cell, [
    { text: 'Flushing Fellowship | 法拉盛團契聚會', bold: true },
    { text: '143-11 Willets Point Boulevard', italic: true },
    { text: 'Whitestone, NY 11357', italic: true },
  ]);
}
