/* Riempie Sconti_per_brand.pdf con i dati del modulo web (pdf-lib).
   Usato dalla pagina e dai test in Node: compilaPdf(PDFLib, bytesPdf, dati) -> Uint8Array */
(function (radice) {
  var ANNI = ["2020", "2021", "2022", "2023", "2024", "2025", "2026"];
  var RIGHE_PDF = 67;
  var ORO = [190 / 255, 162 / 255, 100 / 255];

  // Stessa formula del PDF: piu' sconto, piu' oro
  function tinta(n) {
    if (!(n > 0)) return null;
    var t = 0.2 + 0.6 * Math.min(n / 50, 1);
    return ORO.map(function (c) { return 1 - (1 - c) * t; });
  }

  // Helvetica del PDF conosce solo l'alfabeto latino: apostrofi curvi e simili diventano semplici
  function pulisci(s, max) {
    s = String(s || "").replace(/[‘’´`]/g, "'").replace(/[“”]/g, '"')
      .replace(/[^\x20-\x7e -ÿ]/g, "").trim();
    return max ? s.slice(0, max) : s;
  }

  function oggi() {
    var d = new Date();
    return ("0" + d.getDate()).slice(-2) + "/" + ("0" + (d.getMonth() + 1)).slice(-2) + "/" + d.getFullYear();
  }

  function scriviSconto(PDFLib, form, nome, valore) {
    var n = Number(String(valore || "").replace(",", "."));
    if (valore === "" || valore == null || isNaN(n)) return;
    var campo = form.getTextField(nome);
    campo.setText(String(valore).replace(".", ",") + "%");
    var c = tinta(n);
    if (c) {
      campo.acroField.getWidgets().forEach(function (w) {
        w.getOrCreateAppearanceCharacteristics().setBackgroundColor(c);
      });
    }
  }

  async function compilaPdf(PDFLib, bytes, dati) {
    var pdf = await PDFLib.PDFDocument.load(bytes);
    var form = pdf.getForm();
    var helv = await pdf.embedFont(PDFLib.StandardFonts.Helvetica);

    ANNI.forEach(function (_, i) { scriviSconto(PDFLib, form, "tutti_" + (i + 1), dati.base.sconti[i]); });
    if (dati.base.nota) form.getTextField("tutti_note").setText(pulisci(dati.base.nota, 40));

    dati.brand.slice(0, RIGHE_PDF).forEach(function (b, r) {
      var k = ("0" + (r + 1)).slice(-2);
      form.getTextField("brand_" + k).setText(pulisci(b.nome, 28).toUpperCase());
      ANNI.forEach(function (_, i) { scriviSconto(PDFLib, form, "s_" + k + "_" + (i + 1), b.sconti[i]); });
      if (b.nota) form.getTextField("note_" + k).setText(pulisci(b.nota, 40));
    });
    form.getTextField("aggiornato").setText(oggi());
    form.updateFieldAppearances(helv);
    return pdf.save();
  }

  var api = { compilaPdf: compilaPdf, tinta: tinta, ANNI: ANNI, RIGHE_PDF: RIGHE_PDF, oggi: oggi };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else radice.NDPSconti = api;
})(this);
