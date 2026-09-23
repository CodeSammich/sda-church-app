/**
 * Brooklyn-specific printed bulletin presentation.
 *
 * The data join and cover remain shared with Queens. Brooklyn keeps its own
 * service-flow helpers here so location-specific schedule changes do not
 * change the Queens regular reference layout.
 */

function renderPrintedBrooklynCoverPanel_(cell, bulletin, format) {
  appendSharedCoverPanel_(cell, bulletin, format);
}
