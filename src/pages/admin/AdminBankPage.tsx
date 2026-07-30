import { useState, useEffect } from 'react';
import { getBankDetails, saveBankDetails, type BankDetails, DEFAULT_BANK_DETAILS } from '../../services/bankService';
import { FiCreditCard, FiSave, FiCopy, FiCheck, FiInfo } from 'react-icons/fi';
import toast from 'react-hot-toast';

export default function AdminBankPage() {
  const [bankForm, setBankForm] = useState<BankDetails>(DEFAULT_BANK_DETAILS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const data = await getBankDetails();
      setBankForm(data);
      setLoading(false);
    }
    load();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await saveBankDetails(bankForm);
      toast.success('Datos bancarios guardados correctamente');
    } catch (err: any) {
      console.error(err);
      toast.error('Error al guardar datos bancarios');
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    toast.success(`${label} copiado al portapapeles`);
    setTimeout(() => setCopiedField(null), 2000);
  };

  if (loading) return <div className="page-loader"><div className="spinner" /></div>;

  return (
    <div className="admin-bank-page">
      <div className="admin-header">
        <div>
          <h1>Datos Bancarios de Transferencia</h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', marginTop: 4 }}>
            Cargá los datos de tu cuenta bancaria o billetera virtual para que los clientes puedan transferirte y subir su comprobante.
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Formulario de Edición */}
        <div className="admin-card" style={{ background: 'var(--color-bg)', padding: 24, borderRadius: 12, border: '1px solid var(--color-border)' }}>
          <h3 style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--text-lg)' }}>
            <FiCreditCard style={{ color: 'var(--color-primary)' }} /> Editar Cuenta Bancaria
          </h3>

          <form onSubmit={handleSave}>
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label" style={{ fontWeight: 600 }}>Banco o Entidad Financiera</label>
              <input
                className="form-input"
                value={bankForm.bankName}
                onChange={(e) => setBankForm({ ...bankForm, bankName: e.target.value })}
                placeholder="Ej: Mercado Pago / Banco Galicia"
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label" style={{ fontWeight: 600 }}>Nombre del Titular de la Cuenta</label>
              <input
                className="form-input"
                value={bankForm.accountHolder}
                onChange={(e) => setBankForm({ ...bankForm, accountHolder: e.target.value })}
                placeholder="Ej: Cristina Bronzatti"
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label" style={{ fontWeight: 600 }}>CBU o CVU (22 dígitos)</label>
              <input
                className="form-input"
                value={bankForm.cbu}
                onChange={(e) => setBankForm({ ...bankForm, cbu: e.target.value.trim() })}
                placeholder="Ej: 0000003100012345678901"
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label" style={{ fontWeight: 600 }}>Alias</label>
              <input
                className="form-input"
                value={bankForm.alias}
                onChange={(e) => setBankForm({ ...bankForm, alias: e.target.value.trim() })}
                placeholder="Ej: ESI.SECUNDARIA.MP"
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label" style={{ fontWeight: 600 }}>CUIT / CUIL (Opcional)</label>
              <input
                className="form-input"
                value={bankForm.cuit || ''}
                onChange={(e) => setBankForm({ ...bankForm, cuit: e.target.value })}
                placeholder="Ej: 27-30000000-8"
              />
            </div>

            <div className="form-group" style={{ marginBottom: 20 }}>
              <label className="form-label" style={{ fontWeight: 600 }}>Instrucciones adicionales para el cliente</label>
              <textarea
                className="form-textarea"
                rows={3}
                value={bankForm.notes || ''}
                onChange={(e) => setBankForm({ ...bankForm, notes: e.target.value })}
                placeholder="Ej: Realizá la transferencia y adjuntá la foto o PDF del comprobante antes de finalizar la compra."
              />
            </div>

            <button type="submit" className="btn btn--primary btn--full" disabled={saving}>
              <FiSave /> {saving ? 'Guardando datos...' : 'Guardar datos bancarios'}
            </button>
          </form>
        </div>

        {/* Vista Previa del Cliente */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="admin-card" style={{ background: 'var(--color-bg-alt)', padding: 24, borderRadius: 12, border: '1px solid var(--color-border)' }}>
            <h3 style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--text-md)', color: 'var(--color-primary)' }}>
              <FiInfo /> Vista Previa (Lo que verá el comprador)
            </h3>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 20 }}>
              Así se mostrarán tus datos bancarios en la pantalla de pago (Checkout).
            </p>

            <div style={{ background: 'var(--color-bg)', padding: 20, borderRadius: 12, border: '1.5px dashed var(--color-primary)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <FiCreditCard size={20} style={{ color: 'var(--color-primary)' }} />
                <h4 style={{ margin: 0, fontSize: 'var(--text-base)' }}>Datos para Transferencia</h4>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 'var(--text-sm)' }}>
                <div>
                  <span style={{ color: 'var(--color-text-muted)', display: 'block', fontSize: 'var(--text-xs)' }}>Banco / Entidad:</span>
                  <strong style={{ color: 'var(--color-text)' }}>{bankForm.bankName || '-'}:</strong>
                </div>

                <div>
                  <span style={{ color: 'var(--color-text-muted)', display: 'block', fontSize: 'var(--text-xs)' }}>Titular:</span>
                  <strong style={{ color: 'var(--color-text)' }}>{bankForm.accountHolder || '-'}</strong>
                </div>

                {bankForm.cuit && (
                  <div>
                    <span style={{ color: 'var(--color-text-muted)', display: 'block', fontSize: 'var(--text-xs)' }}>CUIT / CUIL:</span>
                    <span style={{ color: 'var(--color-text)', fontFamily: 'var(--font-mono)' }}>{bankForm.cuit}</span>
                  </div>
                )}

                <div style={{ background: 'var(--color-bg-alt)', padding: 10, borderRadius: 8, marginTop: 4 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <div>
                      <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)', display: 'block' }}>CBU / CVU:</span>
                      <strong style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', wordBreak: 'break-all' }}>{bankForm.cbu || '-'}</strong>
                    </div>
                    <button
                      type="button"
                      className="btn btn--outline btn--sm"
                      onClick={() => copyToClipboard(bankForm.cbu, 'CBU')}
                      style={{ flexShrink: 0, marginLeft: 8 }}
                    >
                      {copiedField === 'CBU' ? <FiCheck color="green" /> : <FiCopy />} Copiar
                    </button>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--color-border)', paddingTop: 6 }}>
                    <div>
                      <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)', display: 'block' }}>Alias:</span>
                      <strong style={{ color: 'var(--color-primary)', fontSize: 'var(--text-sm)' }}>{bankForm.alias || '-'}</strong>
                    </div>
                    <button
                      type="button"
                      className="btn btn--outline btn--sm"
                      onClick={() => copyToClipboard(bankForm.alias, 'Alias')}
                      style={{ flexShrink: 0, marginLeft: 8 }}
                    >
                      {copiedField === 'Alias' ? <FiCheck color="green" /> : <FiCopy />} Copiar
                    </button>
                  </div>
                </div>

                {bankForm.notes && (
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', fontStyle: 'italic', marginTop: 8 }}>
                    💡 {bankForm.notes}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
