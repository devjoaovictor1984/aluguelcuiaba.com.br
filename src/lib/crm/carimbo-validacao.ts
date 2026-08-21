import 'server-only'
import { StandardFonts, rgb, type PDFDocument } from 'pdf-lib'
import QRCode from 'qrcode'

/**
 * Carimbo de autenticidade no rodapé de TODAS as páginas do PDF final (v83).
 *
 * O certificado prova a assinatura pra quem tem o arquivo; o carimbo serve
 * pra quem recebe a via impressa e precisa conferir na fonte — lê o QR ou
 * digita o código em /validar.
 *
 * Vai por pdf-lib, depois do merge, porque assim pega de uma vez as páginas
 * do contrato e as do certificado (que nascem de renderizadores diferentes).
 */
export async function carimbarValidacao(
  pdf: PDFDocument,
  opts: { codigo: string; urlValidacao: string },
) {
  const fonte = await pdf.embedFont(StandardFonts.Helvetica)
  const fonteBold = await pdf.embedFont(StandardFonts.HelveticaBold)

  // 'M' aguenta ~15% de sujeira/dobra no papel sem parar de ler.
  const qrDataUrl = await QRCode.toDataURL(opts.urlValidacao, {
    errorCorrectionLevel: 'M', margin: 0, width: 160,
  })
  const qr = await pdf.embedPng(qrDataUrl)

  const cinza = rgb(0.53, 0.56, 0.59)
  const escuro = rgb(0.23, 0.25, 0.28)
  const QR_TAM = 34

  for (const page of pdf.getPages()) {
    const { width } = page.getSize()
    const x = 48
    page.drawImage(qr, { x, y: 13, width: QR_TAM, height: QR_TAM })

    const xTexto = x + QR_TAM + 8
    const larguraMax = width - xTexto - 48
    page.drawText('Documento assinado eletronicamente na plataforma AluguelCuiabá.', {
      x: xTexto, y: 38, size: 6.5, font: fonte, color: cinza, maxWidth: larguraMax,
    })
    page.drawText('Verifique a autenticidade em aluguelcuiaba.com.br/validar', {
      x: xTexto, y: 28.5, size: 6.5, font: fonte, color: cinza, maxWidth: larguraMax,
    })
    page.drawText(`Código: ${opts.codigo}`, {
      x: xTexto, y: 17, size: 7.5, font: fonteBold, color: escuro, maxWidth: larguraMax,
    })
  }
}
