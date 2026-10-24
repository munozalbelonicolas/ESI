import type { VercelRequest, VercelResponse } from '@vercel/node';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb, requireUser } from './_admin.ts';
import { handleApiCors } from './_cors.ts';

/** One-time admin migration: move legacy URLs out of publicly readable product documents. */
export async function migrateProductDownloads(req: VercelRequest, res: VercelResponse) {
  if (handleApiCors(req, res, ['POST'])) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const user = await requireUser(req);
    if (!user?.isAdmin) return res.status(403).json({ error: 'Acceso restringido a administradores' });

    const db = getAdminDb();
    const dryRun = req.body?.dryRun === true;
    const snapshot = await db.collection('products').get();
    let migrated = 0;
    let cleaned = 0;
    let skippedInvalid = 0;
    let productsToMarkReady = 0;
    let productsToKeepHidden = 0;
    const linksToMigrate: { productId: string; productName: string; displayUrl: string }[] = [];
    const invalidProducts: { productId: string; productName: string }[] = [];
    const previewLimit = 100;

    for (let offset = 0; offset < snapshot.docs.length; offset += 200) {
      const batch = db.batch();
      for (const product of snapshot.docs.slice(offset, offset + 200)) {
        const data = product.data();
        const legacyUrl = data.digitalFileUrl;
        const hasLegacyField = Object.prototype.hasOwnProperty.call(data, 'digitalFileUrl');
        let hasPrivateDownload = false;
        let invalidLegacyValue = false;
        if (typeof legacyUrl === 'string' && legacyUrl.trim()) {
          let valid = false;
          try { valid = new URL(legacyUrl).protocol === 'https:'; } catch { /* invalid legacy value */ }
          if (valid) {
            if (dryRun && linksToMigrate.length < previewLimit) {
              const displayUrl = new URL(legacyUrl);
              displayUrl.username = '';
              displayUrl.password = '';
              displayUrl.search = '';
              displayUrl.hash = '';
              linksToMigrate.push({
                productId: product.id,
                productName: typeof data.name === 'string' ? data.name : '(producto sin nombre)',
                displayUrl: displayUrl.toString(),
              });
            }
            if (!dryRun) {
              batch.set(db.collection('productDownloads').doc(product.id), {
                downloadUrl: legacyUrl,
                updatedAt: new Date(),
                migratedAt: new Date(),
              }, { merge: true });
            }
            migrated++;
            hasPrivateDownload = true;
          } else {
            skippedInvalid++;
            invalidLegacyValue = true;
            if (dryRun && invalidProducts.length < previewLimit) {
              invalidProducts.push({
                productId: product.id,
                productName: typeof data.name === 'string' ? data.name : '(producto sin nombre)',
              });
            }
          }
        } else if (hasLegacyField && legacyUrl != null && typeof legacyUrl !== 'string') {
          skippedInvalid++;
          invalidLegacyValue = true;
          if (dryRun && invalidProducts.length < previewLimit) {
            invalidProducts.push({
              productId: product.id,
              productName: typeof data.name === 'string' ? data.name : '(producto sin nombre)',
            });
          }
        }
        const publicCatalogReady = !invalidLegacyValue;
        if (publicCatalogReady && data.publicCatalogReady !== true) productsToMarkReady++;
        if (!publicCatalogReady) productsToKeepHidden++;

        if (hasLegacyField && !invalidLegacyValue) cleaned++;
        if (!dryRun) {
          const update: Record<string, unknown> = {
            publicCatalogReady,
            updatedAt: new Date(),
          };
          if (hasLegacyField && !invalidLegacyValue) {
            update.digitalFileUrl = FieldValue.delete();
            update.hasDigitalDownload = hasPrivateDownload || data.hasDigitalDownload === true;
          }
          batch.update(product.ref, update);
        }
      }
      if (!dryRun) await batch.commit();
    }

    return res.status(200).json({
      success: true,
      dryRun,
      migrated,
      cleaned,
      skippedInvalid,
      productsToMarkReady,
      productsToKeepHidden,
      ...(dryRun ? {
        linksToMigrate,
        invalidProducts,
        previewTruncated: migrated > previewLimit,
        invalidProductsTruncated: productsToKeepHidden > previewLimit,
      } : {}),
    });
  } catch (error: any) {
    console.error('[ProductDownloadMigration] Error:', error?.message || error);
    return res.status(500).json({ error: 'No se pudo completar la migración' });
  }
}
