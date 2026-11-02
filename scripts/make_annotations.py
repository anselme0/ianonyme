import json, sys, pathlib
C = pathlib.Path(__file__).resolve().parent.parent / "corpus"
D, I = "direct", "indirect"
def E(id, cat, canon, *ms): return {"id": id, "category": cat, "canonical": canon, "mentions": [{"text": t, "kind": k} for t, k in ms]}
A = {
"ajust-01": [
 E("E1","PERSONNE","Philippe Lacombe",("Philippe Lacombe",D),("P. Lacombe",D)),
 E("E2","ADRESSE","14 rue des Tilleuls",("14 rue des Tilleuls, 69003 Lyon",D)),
 E("E3","TELEPHONE","04 72 33 18 45",("04 72 33 18 45",D)),
 E("E4","EMAIL","p.lacombe@expertises-lacombe.fr",("p.lacombe@expertises-lacombe.fr",D)),
 E("E5","PERSONNE","Jean Garnier",("Jean Garnier",D),("M. Garnier",D),("Garnier",D),("Le maire de la commune",I)),
 E("E6","PERSONNE","Claire Vidal",("Claire Vidal",D)),
 E("E7","ORGANISATION","BATIFRANCE SARL",("BATIFRANCE SARL",D)),
 E("E8","PERSONNE","Sophie Renard",("Sophie Renard",D)),
 E("E9","PERSONNE","beau-frère de Sophie Renard",("son beau-frère",I)),
 E("E10","PERSONNE","prédécesseur de Garnier",("son prédécesseur",I)),
 E("E11","TELEPHONE","06 12 34 56 78",("06 12 34 56 78",D)),
 E("E12","IBAN","FR76 3000 6000 0112 3456 7890 189",("FR76 3000 6000 0112 3456 7890 189",D)),
 E("E13","NUM_DOSSIER","RG 24/01532",("RG 24/01532",D)),
 E("E14","NUM_DOSSIER","EXP-2024-0417",("EXP-2024-0417",D)),
 E("E15","LIEU","Valmont-sur-Aure",("Valmont-sur-Aure",D)),
],
"ajust-02": [
 E("E1","PERSONNE","Isabelle Moreau",("Isabelle Moreau",D),("Mme Moreau",D),("Madame Isabelle Moreau",D),("Isabelle MOREAU",D)),
 E("E2","DATE_NAISSANCE","14 avril 1981",("14 avril 1981",D)),
 E("E3","ADRESSE","8 avenue de la République",("8 avenue de la République, 21000 Dijon",D)),
 E("E4","PERSONNE","Marc Moreau",("Marc Moreau",D),("Son époux",I),("son mari",I)),
 E("E5","ORGANISATION","DUCRET FRÈRES SAS",("DUCRET FRÈRES SAS",D),("Société DUCRET FRÈRES",D)),
 E("E6","PERSONNE","Henri Ducret",("Henri Ducret",D),("M. Henri Ducret",D),("Ducret",D),("Le gérant de l'entreprise",I)),
 E("E7","PERSONNE","Nadia Benali",("Nadia Benali",D),("la directrice de l'agence bancaire",I)),
 E("E8","PERSONNE","soeur d'Isabelle Moreau",("Sa sœur",I)),
 E("E9","EMAIL","h.ducret@ducret-freres.fr",("h.ducret@ducret-freres.fr",D)),
 E("E10","PERSONNE","voisin des Moreau",("Le voisin du couple",I)),
 E("E11","NUM_DOSSIER","Parquet 23/4471",("n° 23/4471",D)),
],
"ajust-03": [
 E("E1","PERSONNE","Étienne Faure",("Étienne Faure",D),("M. Étienne Faure",D),("Le propriétaire",I)),
 E("E2","PERSONNE","Léa Faure",("Léa Faure",D),("épouse du propriétaire",I)),
 E("E3","TELEPHONE","07 61 22 90 14",("07 61 22 90 14",D)),
 E("E4","EMAIL","l.faure@mail-prive.fr",("l.faure@mail-prive.fr",D)),
 E("E5","PERSONNE","Karim Haddad",("Karim Haddad",D),("Haddad",D),("le locataire du second étage",I)),
 E("E6","ADRESSE","3 impasse des Lilas",("3 impasse des Lilas, 38000 Grenoble",D)),
 E("E7","PERSONNE","belle-mère de Karim Haddad",("La belle-mère de M. Haddad",I)),
 E("E8","ORGANISATION","IMMOLUX SCI",("IMMOLUX SCI",D)),
 E("E9","ORGANISATION","Cabinet Rolland et Associés",("Cabinet Rolland et Associés",D)),
 E("E10","ADRESSE","22 boulevard Gambetta",("22 boulevard Gambetta, 38000 Grenoble",D)),
 E("E11","PERSONNE","M. Faure (syndic)",("Le syndic, M. Faure",I),("frère d'Étienne",I)),
 E("E12","NUM_DOSSIER","EXP-2024-0502",("EXP-2024-0502",D)),
],
"eval-01": [
 E("E1","PERSONNE","Antoine Delmas",("Antoine Delmas",D),("A. Delmas",D)),
 E("E2","ADRESSE","27 chemin des Vignes",("27 chemin des Vignes, 33000 Bordeaux",D)),
 E("E3","TELEPHONE","05 56 78 90 12",("05 56 78 90 12",D)),
 E("E4","EMAIL","a.delmas@delmas-expert.fr",("a.delmas@delmas-expert.fr",D)),
 E("E5","PERSONNE","Corinne Lefèvre",("Corinne Lefèvre",D),("Mme Lefèvre",D),("Lefèvre",D),("directrice de la clinique des Cèdres",I),("la directrice",I)),
 E("E6","PERSONNE","Olivier Brun",("Olivier Brun",D),("M. Brun",D)),
 E("E7","PERSONNE","Sylvie Marchand",("Sylvie Marchand",D)),
 E("E8","ORGANISATION","SAS CLINIQUE DES CÈDRES",("SAS CLINIQUE DES CÈDRES",D),("clinique des Cèdres",D)),
 E("E9","PERSONNE","chef du service technique",("le chef du service technique",I)),
 E("E10","PERSONNE","fils de Corinne Lefèvre",("le fils de la directrice",I)),
 E("E11","IBAN","FR14 2004 1010 0505 0001 3M02 606",("FR14 2004 1010 0505 0001 3M02 606",D)),
 E("E12","LIEU","Pessac",("Pessac",D)),
 E("E13","NUM_DOSSIER","RG 25/00871",("RG 25/00871",D)),
 E("E14","NUM_DOSSIER","EXP-2025-0133",("EXP-2025-0133",D)),
],
"eval-02": [
 E("E1","PERSONNE","Claude Perrin",("Claude Perrin",D),("M. Claude Perrin",D),("son oncle",I),("l'aîné",I)),
 E("E2","PERSONNE","Julien Perrin",("Julien Perrin",D),("son neveu",I),("Le comptable de la société TRANSPORTS ROUSSEAU",I)),
 E("E3","DATE_NAISSANCE","3 mars 1950",("3 mars 1950",D)),
 E("E4","ORGANISATION","TRANSPORTS ROUSSEAU",("TRANSPORTS ROUSSEAU",D)),
 E("E5","ADRESSE","5 place du Marché",("5 place du Marché, 42000 Saint-Étienne",D)),
 E("E6","PERSONNE","Aurélie Rousseau",("Aurélie Rousseau",D),("Mme Aurélie Rousseau",D),("La présidente",I),("présidente de l'association locale",I)),
 E("E7","PERSONNE","ancien maire",("l'ancien maire",I)),
 E("E8","EMAIL","a.rousseau@asso-stetienne.fr",("a.rousseau@asso-stetienne.fr",D)),
 E("E9","TELEPHONE","04 77 12 34 56",("04 77 12 34 56",D)),
 E("E10","IDENTIFIANT","AB-123-CD",("AB-123-CD",D)),
 E("E11","NUM_DOSSIER","Parquet 24/9920",("n° 24/9920",D)),
],
"eval-03": [
 E("E1","PERSONNE","Thomas Barbier",("Thomas Barbier",D),("M. Thomas Barbier",D),("Barbier",D),("Le demandeur",I)),
 E("E2","PERSONNE","Hélène Giraud",("Hélène Giraud",D),("Mme Giraud",D),("expert en bâtiment",I)),
 E("E3","ADRESSE","9 rue Pasteur",("9 rue Pasteur, 31000 Toulouse",D)),
 E("E4","TELEPHONE","06 45 67 89 01",("06 45 67 89 01",D)),
 E("E5","PERSONNE","gendre de Giraud",("le gendre de Mme Giraud",I)),
 E("E6","PERSONNE","Paul Morel",("Paul Morel",D),("L'architecte du projet",I)),
 E("E7","PERSONNE","syndic",("Le syndic de la copropriété",I)),
 E("E8","PERSONNE","cousine de Giraud",("sa cousine, notaire à Albi",I)),
 E("E9","LIEU","Albi",("Albi",D)),
 E("E10","ORGANISATION","Mairie de Cugnaux",("La Mairie de Cugnaux",D)),
 E("E11","ORGANISATION","SCI LES PINS",("SCI LES PINS",D)),
 E("E12","PERSONNE","Roger Meunier",("Roger Meunier",D),("le gérant de la SCI LES PINS",I)),
 E("E13","EMAIL","h.giraud@orange.fr",("h.giraud@orange.fr",D)),
 E("E14","NUM_DOSSIER","RG 25/03307",("RG 25/03307",D)),
],
}
bad = 0
for name, ents in A.items():
    (C / f"{name}.annotations.json").write_text(json.dumps({"document": name + ".txt", "entities": ents}, ensure_ascii=False, indent=1), encoding="utf-8")
    txt = (C / f"{name}.txt").read_text(encoding="utf-8")
    for e in ents:
        for m in e["mentions"]:
            if m["text"] not in txt:
                bad += 1; print("ABSENT", name, e["id"], repr(m["text"]))
print("annotations ok" if not bad else f"{bad} mentions absentes")
sys.exit(1 if bad else 0)
