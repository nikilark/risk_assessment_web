export const methodology = {
  primary: [
    { label: "МОЗ України, наказ №184 від 13.04.2007 — базові хронічні RfC та SF", url: "https://zakon.rada.gov.ua/rada/show/v0184282-07" },
    {
      label: "МОЗ України, наказ №89 від 17.01.2022",
      url: "https://moz.gov.ua/uk/decrees/nakaz-moz-ukraini-vid-17012022--89-pro-zatverdzhennja-metodichnih--rekomendacij-ocinka-riziku-dlja--zdorovja-naselennja-vid-zabrudnennja-atmosfernogo-povitrja"
    },
    {
      label: "МОЗ України, методичні рекомендації №1811 від 18.10.2023",
      url: "https://moz.gov.ua/uploads/10/50566-dn_1811_18102023_met_rek.pdf"
    }
  ],
  crossChecks: [
    { label: "OEHHA — гострі інгаляційні REL (мкг/м³ → мг/м³)", url: "https://oehha.ca.gov/air/general-info/oehha-acute-8-hour-and-chronic-reference-exposure-level-rel-summary" },
    { label: "Малишевська, 2021, табл. 3 — CO 3 мг/м³ як еквівалент ГДК", url: "https://doi.org/10.31393/reports-vnmedical-2021-25(1)-27" },
    {
      label: "EPA RAGS Part F",
      url: "https://www.epa.gov/risk/risk-assessment-guidance-superfund-rags-part-f"
    },
    {
      label: "EPA Regional Screening Levels User Guide",
      url: "https://www.epa.gov/risk/regional-screening-levels-rsls-users-guide"
    },
    {
      label: "ATSDR hazard quotient and cancer risk guidance",
      url: "https://www.atsdr.cdc.gov/pha-guidance/conducting_scientific_evaluations/epcs_and_exposure_calculations/hazardquotients_cancerrisk.html"
    }
  ],
  caution:
    "Модель використовує параметри застосунку й дипломного опису з довічними віковими періодами 6/12/52 роки. Для TSP застосовується PM10 = 0.6 × TSP. Одиниці концентрації та класифікація смертності потребують окремої перевірки; наведені джерела є методичними орієнтирами. Перевірені хронічні RfC та SF спираються на МОЗ №184/2007, гострі REL — на OEHHA. Для CO хронічний HQ використовує еквівалент ГДК 3 мг/м³ (Малишевська, 2021), а не встановлену EPA RfC. Не всі параметри розширеного каталогу перевірені; джерела уточнень збережені біля відповідних параметрів."
};
