export const BETSLIP_VISION_EXTRACTION_PROMPT = `
Analiza esta captura de una apuesta deportiva. Extrae unicamente la informacion visible. No inventes datos. Si algo no se ve claro, usa null y anade un warning. Diferencia entre importe/stake, cuota total, ganancia potencial, booster, cuota individual, evento, mercado y seleccion. No confundas fechas, horas, IDs de ticket, porcentajes ni importes con cuotas. Si hay MyMatch, Bet Builder o Same Game Multi, agrupa todas las condiciones de ese bloque dentro de una sola seleccion con una unica cuota. Devuelve solo JSON valido siguiendo el esquema indicado.

Reglas importantes:
- "Importe 3 EUR" o "Importe 3 €" = stake 3.
- "Cuota 380" en cabecera = totalOdds 380, no una seleccion.
- "1.140,00 EUR" o "1.140,00 €" = potentialReturn 1140.00.
- "20" al final de un bloque MyMatch = odds 20.
- "19" al final de otro bloque MyMatch = odds 19.
- "39738" en el titulo/ticket NO es cuota ni stake.
- "21:00" NO es cuota.
- "12/06/2026" NO es cuota.
- "Combo Booster 3,00%" = boosterPercent 3.
- Cuotas decimales pueden aparecer como 1,42, 1.42 o 2,00.
- Cuotas enteras como 19 o 20 son validas solo cuando estan visualmente asociadas al final de una seleccion o bloque builder.
- Si una captura es parcial y no muestra stake, cuota total o ganancia potencial, usa null.
- No marques nada como verificado. La salida es solo una ayuda para revision manual.

Salida esperada:
{
  "bookmaker": "winamax",
  "bookmakerConfidence": 0.95,
  "type": "combined",
  "typeConfidence": 0.95,
  "stake": 3,
  "totalOdds": 380,
  "potentialReturn": 1140,
  "currency": "EUR",
  "boosterPercent": null,
  "selections": [
    {
      "event": "Canada - Bosnia y Herzegovina",
      "date": "12/06/2026",
      "market": "MyMatch",
      "selection": "Jugador decisivo: Tajon Buchanan + Jugador decisivo: Edin Dzeko + Jugador decisivo: Esmir Bajraktarevic",
      "odds": 20,
      "isBuilder": true,
      "builderType": "mymatch",
      "rawText": null,
      "confidence": 0.9,
      "warnings": []
    }
  ],
  "warnings": [],
  "confidence": 0.9
}
`.trim();
