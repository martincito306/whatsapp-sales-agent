const fs = require('fs');
const path = require('path');
const axios = require('axios');

/**
 * SERVICIO DE ALMACENAMIENTO PRIVADO DE COMPROBANTES
 * Almacena en un bucket PRIVADO de Supabase Storage (con Signed URLs temporales)
 * o en una carpeta local privada servida únicamente a través de rutas autenticadas.
 */
class StorageService {
  constructor() {
    this.bucketName = 'receipts';
    this.localUploadDir = path.join(__dirname, '../uploads/receipts');
    if (!fs.existsSync(this.localUploadDir)) {
      fs.mkdirSync(this.localUploadDir, { recursive: true });
    }
  }

  get supabaseUrl() {
    return process.env.SUPABASE_URL;
  }

  get supabaseKey() {
    return process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_KEY;
  }

  /**
   * Guardar comprobante en bucket privado y devolver referencia interna segura
   */
  async uploadReceipt(fileBuffer, originalFilename, mimeType = 'image/jpeg') {
    const safeExt = path.extname(originalFilename).replace(/[^a-zA-Z0-9.]/g, '') || '.jpg';
    const uniqueFilename = `recibo_${Date.now()}_${Math.random().toString(36).substring(7)}${safeExt}`;

    // 1. Subir a Bucket Privado en Supabase Storage
    if (this.supabaseUrl && this.supabaseKey) {
      try {
        const uploadEndpoint = `${this.supabaseUrl}/storage/v1/object/${this.bucketName}/${uniqueFilename}`;
        const uploadRes = await axios.post(uploadEndpoint, fileBuffer, {
          headers: {
            Authorization: `Bearer ${this.supabaseKey}`,
            apikey: this.supabaseKey,
            'Content-Type': mimeType
          }
        });

        if (uploadRes.status === 200 || uploadRes.status === 201) {
          return {
            success: true,
            reference: `supabase:${uniqueFilename}`,
            storage: 'supabase',
            filename: uniqueFilename
          };
        }
      } catch (error) {
        console.warn('⚠️ Supabase Storage no disponible, usando almacenamiento privado local.');
      }
    }

    // 2. Fallback: Guardar en almacenamiento privado local (no expuesto por express.static)
    const localFilePath = path.join(this.localUploadDir, uniqueFilename);
    fs.writeFileSync(localFilePath, fileBuffer);
    return {
      success: true,
      reference: `local:${uniqueFilename}`,
      storage: 'local',
      filename: uniqueFilename
    };
  }

  /**
   * Generar Signed URL temporal (60 min) o ruta local protegida solo para el Admin autenticado
   */
  async getSignedUrlOrLocalPath(receiptReference) {
    if (!receiptReference) return null;

    if (receiptReference.startsWith('supabase:')) {
      const filename = receiptReference.replace('supabase:', '');
      if (this.supabaseUrl && this.supabaseKey) {
        try {
          const signEndpoint = `${this.supabaseUrl}/storage/v1/object/sign/${this.bucketName}/${filename}`;
          const signRes = await axios.post(
            signEndpoint,
            { expiresIn: 3600 },
            {
              headers: {
                Authorization: `Bearer ${this.supabaseKey}`,
                apikey: this.supabaseKey,
                'Content-Type': 'application/json'
              }
            }
          );
          if (signRes.data?.signedURL) {
            return { type: 'redirect', url: `${this.supabaseUrl}/storage/v1${signRes.data.signedURL}` };
          }
        } catch (err) {
          console.error('❌ Error generando Signed URL en Supabase:', err.message);
        }
      }
    }

    if (receiptReference.startsWith('local:')) {
      const filename = path.basename(receiptReference.replace('local:', ''));
      const fullPath = path.join(this.localUploadDir, filename);
      if (fs.existsSync(fullPath)) {
        return { type: 'file', path: fullPath };
      }
    }

    return null;
  }

  /**
   * Descargar binario de WhatsApp Cloud API con el Token de Meta y guardarlo en Storage Privado
   */
  async processWhatsAppMedia(mediaUrl, whatsappToken) {
    if (!mediaUrl || !whatsappToken) return null;
    try {
      const response = await axios.get(mediaUrl, {
        headers: { Authorization: `Bearer ${whatsappToken}` },
        responseType: 'arraybuffer'
      });

      const buffer = Buffer.from(response.data);
      const mimeType = response.headers['content-type'] || 'image/jpeg';
      return await this.uploadReceipt(buffer, 'whatsapp_receipt.jpg', mimeType);
    } catch (error) {
      console.error('❌ Error descargando multimedia de WhatsApp:', error.message);
      return null;
    }
  }
}

module.exports = new StorageService();
