/* Riempie Sconti_per_brand.pdf con i dati del modulo web (pdf-lib).
   Usato dalla pagina e dai test in Node: compilaPdf(PDFLib, bytesPdf, dati) -> Uint8Array */
(function (radice) {
  var ANNI = ["2020", "2021", "2022", "2023", "2024", "2025", "2026"];
  // Devono restare uguali a genera_pdf.py (RIGHE_P1, RIGHE_P2, pagine=4 della copia web)
  var RIGHE_P1 = 30, RIGHE_PAGINA = 37, PAGINE = 4;
  var RIGHE_PDF = RIGHE_P1 + (PAGINE - 1) * RIGHE_PAGINA;
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

  function pagineServono(righe) {
    return righe <= RIGHE_P1 ? 1 : 1 + Math.ceil((righe - RIGHE_P1) / RIGHE_PAGINA);
  }

  function scriviSconto(form, nome, valore) {
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

  // Toglie le pagine finali rimaste vuote e i loro campi (campo e widget sono lo stesso oggetto)
  function togliPagineVuote(PDFLib, pdf, form, tenere) {
    var via = {};
    for (var p = pdf.getPageCount() - 1; p >= tenere; p--) {
      var annots = pdf.getPage(p).node.Annots();
      for (var i = 0; annots && i < annots.size(); i++) via[annots.get(i).toString()] = true;
      pdf.removePage(p);
    }
    var nome = PDFLib.PDFName.of("Fields");
    var vecchi = form.acroForm.dict.lookup(nome, PDFLib.PDFArray);
    var nuovi = pdf.context.obj([]);
    for (var j = 0; j < vecchi.size(); j++) {
      var ref = vecchi.get(j);
      if (!via[ref.toString()]) nuovi.push(ref);
    }
    form.acroForm.dict.set(nome, nuovi);
  }

  async function compilaPdf(PDFLib, bytes, dati) {
    var pdf = await PDFLib.PDFDocument.load(bytes);
    var form = pdf.getForm();
    var helv = await pdf.embedFont(PDFLib.StandardFonts.Helvetica);
    var elenco = dati.brand.slice(0, RIGHE_PDF);

    ANNI.forEach(function (_, i) { scriviSconto(form, "tutti_" + (i + 1), dati.base.sconti[i]); });
    if (dati.base.nota) form.getTextField("tutti_note").setText(pulisci(dati.base.nota, 40));

    elenco.forEach(function (b, r) {
      var k = String(r + 1).padStart(2, "0");  // brand_01 ... brand_141, come in genera_pdf.py
      form.getTextField("brand_" + k).setText(pulisci(b.nome, 28).toUpperCase());
      ANNI.forEach(function (_, i) { scriviSconto(form, "s_" + k + "_" + (i + 1), b.sconti[i]); });
      if (b.nota) form.getTextField("note_" + k).setText(pulisci(b.nota, 40));
    });
    form.getTextField("aggiornato").setText(oggi());
    form.updateFieldAppearances(helv);

    var tot = pagineServono(elenco.length);
    togliPagineVuote(PDFLib, pdf, form, tot);
    if (tot > 1) {
      pdf.getPages().forEach(function (pagina, i) {
        var t = (i + 1) + " / " + tot;
        pagina.drawText(t, { x: pagina.getWidth() - 36 - helv.widthOfTextAtSize(t, 6.4), y: 26, size: 6.4,
                             font: helv, color: PDFLib.rgb(0.66, 0.64, 0.60) });
      });
    }
    return pdf.save({ updateFieldAppearances: false });
  }

  var api = { compilaPdf: compilaPdf, tinta: tinta, ANNI: ANNI, RIGHE_PDF: RIGHE_PDF, oggi: oggi };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else radice.NDPSconti = api;
})(this);
