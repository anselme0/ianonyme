"""Baseline déterministe minimal (regex + variantes de noms), réduit par rapport à l'annexe B.
Sert uniquement à mesurer le gain du LLM dans MODELE_LOCAL_TESTS.md ; ce n'est pas le futur packages/engine."""
import re, unicodedata

CAP = r"[A-ZÉÈÀÂÎÔÛÇ][a-zéèêëàâîïôöùûüç'’\-]+"
CIV = r"(?:M\.|Mme|Me|Maître|Dr|Pr|Monsieur|Madame)"
FIRST = set("""Jean Pierre Paul Marc Henri Philippe Claire Sophie Isabelle Nadia Étienne Léa Karim Antoine Corinne
Olivier Sylvie Claude Julien Aurélie Thomas Hélène Roger Marie Michel Alain Patrick Nicolas Christophe Laurent
David Éric Stéphane Pascal Thierry Bernard Daniel Jacques François Louis Sébastien Vincent Guillaume Maxime
Alexandre Catherine Nathalie Martine Christine Françoise Monique Valérie Sandrine Céline Julie Camille Anne
Émilie Laure Sarah Emma Chloé Lucie Pauline Mathieu Romain Hugo Lucas Nathan""".split())
STOP_SURNAMES = {"Maire", "Avenue", "Rue", "Société", "Monsieur", "Madame"}
MONTHS = "janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre"

def norm(s):
    s = unicodedata.normalize("NFKD", s.replace("’", "'").replace(" ", " "))
    return "".join(c for c in s if not unicodedata.combining(c)).lower()

def iban_ok(s):
    s = re.sub(r"\s", "", s)
    if len(s) < 15: return False
    t = s[4:] + s[:4]
    return int("".join(str(int(c, 36)) for c in t)) % 97 == 1

def occurrences(text, value):
    """Positions (insensibles à la casse/accents, mêmes longueurs) de value dans text, à frontières de mot."""
    nt, nv = norm(text), norm(value)
    if len(nt) != len(text): nt = text.lower()  # secours : ne devrait pas arriver pour le français courant
    if len(norm(value)) != len(value): nv = value.lower()
    out, i = [], 0
    while nv:
        j = nt.find(nv, i)
        if j < 0: break
        before = nt[j - 1] if j else " "
        after = nt[j + len(nv)] if j + len(nv) < len(nt) else " "
        if not (before.isalnum() or before == "_") and not (after.isalnum() or after == "_"):
            out.append((j, j + len(nv)))
        i = j + 1
    return out

def detect(text):
    """Renvoie (valeurs, entités) : valeurs = {texte: catégorie}, entités = [(canonical, catégorie)]."""
    vals, ents = {}, []
    def add(v, cat): vals.setdefault(v.strip(" ,."), cat)
    for m in re.finditer(r"[\w.\-]+@[\w\-]+(?:\.[\w\-]+)+", text): add(m.group(), "EMAIL")
    for m in re.finditer(r"(?<!\d)(?:\+33|0033|0)\s?[1-9](?:[ .\-]?\d{2}){4}(?!\d)", text): add(m.group(), "TELEPHONE")
    for m in re.finditer(r"\b[A-Z]{2}\d{2}(?: ?[A-Z0-9]{4}){2,7}(?: ?[A-Z0-9]{1,3})?\b", text):
        if iban_ok(m.group()): add(m.group(), "IBAN")
    for m in re.finditer(r"\b[A-Z]{2}-\d{3}-[A-Z]{2}\b", text): add(m.group(), "IDENTIFIANT")
    for rx in (r"\bRG\s\d{2}/\d{3,6}", r"\bEXP-\d{4}-\d{4}", r"n°\s?\d{2}/\d{4,5}"):
        for m in re.finditer(rx, text): add(m.group(), "NUM_DOSSIER")
    for m in re.finditer(rf"[Nn]ée?\sle\s(\d{{1,2}}\s(?:{MONTHS})\s\d{{4}})", text): add(m.group(1), "DATE_NAISSANCE")
    for m in re.finditer(r"\d{1,3}\s(?:rue|avenue|boulevard|chemin|impasse|place)\s[^,\n]+,\s*\d{5}\s+[A-ZÉ][\w\-éèô']+", text): add(m.group(), "ADRESSE")
    # organisations
    for rx in (r"\b(?:SARL|SAS|SA|SCI|EURL)\s+(?:[A-ZÉÈ]{2,}\s?)+", r"\b(?:[A-ZÉÈ]{2,}\s)+(?:SARL|SAS|SCI|SA|EURL)\b",
               rf"\b(?:[Ss]ociété|SOCIÉTÉ)\s+(?:[A-ZÉÈ]{{2,}}\s?)+", rf"\b(?:Cabinet|Mairie\s+de|Association)\s+{CAP}(?:\s+(?:et\s+)?{CAP})*"):
        for m in re.finditer(rx, text):
            add(m.group().strip(), "ORGANISATION"); ents.append((m.group().strip(), "ORGANISATION"))
    # personnes
    persons = {}
    def person(full):
        words = full.split()
        persons[full] = words
    for m in re.finditer(rf"\b{CIV}\s+((?:{CAP}|[A-ZÉ]{{3,}})(?:[\s-](?:{CAP}|[A-ZÉ]{{3,}})){{0,2}})", text):
        w = m.group(1).split()
        # retire un éventuel mot minuscule capturé par erreur : la regex n'accepte que des majuscules initiales
        person(" ".join(w))
    for m in re.finditer(rf"\b({CAP})\s+({CAP}|[A-ZÉ]{{3,}})\b", text):
        if m.group(1) in FIRST: person(m.group())
    for m in re.finditer(rf"\b({CAP})\s+({CAP}|[A-ZÉ]{{3,}})\b", text):
        pass
    # une personne : (prénoms) + nom ; on garde les noms complets prénom+nom comme entités
    surname_owner = {}
    for full, words in persons.items():
        if words[0] in FIRST and len(words) >= 2:
            fam = words[-1]
            ents.append((full, "PERSONNE")); add(full, "PERSONNE")
            surname_owner.setdefault(norm(fam), set()).add(full)
        else:
            add(full, "PERSONNE")  # civilité + nom seul : masqué tel quel
            fam = words[-1]; surname_owner.setdefault(norm(fam), set()).add(fam)
    for full, words in persons.items():
        fam = words[-1]
        if len(fam) < 3 or fam in STOP_SURNAMES: continue
        if len(surname_owner.get(norm(fam), ())) > 1:
            continue  # même nom de famille pour plusieurs entités : conflit, jamais propagé
        for v in (fam, fam.upper(), f"M. {fam}", f"Mme {fam}", f"Monsieur {fam}"):
            add(v, "PERSONNE")
        if words[0] in FIRST:
            add(f"{words[0][0]}. {fam}", "PERSONNE"); add(f"{fam} {words[0]}", "PERSONNE")
    # sigle/forme courte des organisations
    for full, cat in list(ents):
        if cat == "ORGANISATION":
            short = re.sub(r"\b(SARL|SAS|SCI|SA|EURL)\b", "", full).strip()
            if len(short) > 4: add(short, "ORGANISATION")
    return vals, ents

def mask_marks(text, values):
    marks = [False] * len(text)
    for v in sorted(values, key=len, reverse=True):
        for a, b in occurrences(text, v):
            for i in range(a, b): marks[i] = True
    return marks

def covered(text, marks, ref):
    occ = occurrences(text, ref)
    return any(sum(marks[a:b]) >= 0.5 * (b - a) for a, b in occ)
