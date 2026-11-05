// Source unique de tous les textes affichés (docs/UI_UX.md, §6).
// Vocabulaire : jamais « API », « LLM », « regex », « token », « JSON », « placeholder »,
// « anonymisation » ni « pseudonymisation ». Vouvoiement. Aucune affirmation juridique.

import type { ErrorCode, FileWarning } from '../shared/api.js';

const plural = (n: number, one: string, many: string): string => (n === 1 ? one : many);

export const t = {
  app: { name: 'IAnonyme' },

  sidebar: {
    newConversation: 'Nouvelle conversation',
    today: "Aujourd'hui",
    settings: 'Paramètres',
    about: 'À propos',
    collapse: 'Replier la barre latérale',
    expand: 'Déplier la barre latérale',
    rename: 'Renommer',
    remove: 'Supprimer',
    userMenu: 'Menu',
    untitled: 'Nouvelle conversation',
  },

  conversation: {
    emptyTitle: 'Par quoi commençons-nous ?',
    youLabel: 'Vous',
    assistantLabel: 'Assistant',
    assistant: 'Assistant',
    simulatedBadge: 'hors ligne',
    renameTitle: 'Modifier le titre',
    restoredNotice: 'Les noms soulignés ont été restitués à partir des repères reçus par l’IA.',
    restoredFrom: (placeholder: string) => `Remplace ${placeholder}`,
    anomaly: "Un repère n'a pas pu être remplacé dans cette réponse.",
    copy: 'Copier',
    copied: 'Copié',
    regenerate: 'Régénérer',
    stop: 'Arrêter',
    generating: 'Réponse en cours…',
    sameEntity: 'Même personne que dans les messages précédents.',
    attachedFile: 'Document joint',
  },

  composer: {
    placeholder: 'Écrivez votre message',
    attach: 'Joindre un fichier',
    send: 'Envoyer',
    verify: 'Vérifier',
    sending: 'Envoi en cours…',
    willProtect: (n: number) =>
      n === 0
        ? ''
        : `${n} ${plural(n, 'élément sera protégé', 'éléments seront protégés')} dans ce message`,
    dropHere: 'Déposez un fichier ici',
    analysing: 'Analyse approfondie en cours…',
    skipAnalysis: 'Passer en analyse de base',
    queuedSend: 'Envoi dès la fin de l’analyse…',
    cancelQueued: 'Annuler l’envoi',
    removeFile: 'Retirer ce fichier',
    cancel: 'Annuler',
  },

  fileSteps: {
    reading: 'Lecture du document',
    detecting: 'Repérage des informations sensibles',
    deep: 'Analyse approfondie',
    ready: 'Prêt',
    failed: 'Fichier refusé',
  },

  families: {
    personnes: 'Personnes',
    organisations: 'Organisations',
    lieux: 'Lieux',
    coordonnees: 'Coordonnées',
    numeros: 'Numéros et références',
  },

  categories: {
    PERSONNE: 'Personne',
    ORGANISATION: 'Organisation',
    LIEU: 'Lieu',
    ADRESSE: 'Adresse',
    EMAIL: 'Adresse e-mail',
    TELEPHONE: 'Téléphone',
    IBAN: 'Compte bancaire',
    DATE_NAISSANCE: 'Date de naissance',
    NUM_DOSSIER: 'Numéro de dossier',
    IDENTIFIANT: 'Identifiant',
    FONCTION: 'Fonction',
    LIEN_PARENTE: 'Lien de parenté',
  } as Record<string, string>,

  protection: {
    title: 'Protection',
    tabElements: 'Éléments protégés',
    protectedCount: (n: number) =>
      n === 0
        ? 'Aucun élément protégé pour le moment'
        : `${n} ${plural(n, 'élément protégé', 'éléments protégés')} dans cette conversation`,
    toReview: (n: number) => `${n} à vérifier`,
    openReview: 'Ouvrir la vérification',
    empty: 'Les informations repérées apparaîtront ici.',
    deepActive: 'Analyse approfondie sur votre ordinateur : active',
    deepActiveSimulated: 'Analyse approfondie simulée (démonstration)',
    deepLoading: 'Analyse approfondie : préparation en cours',
    basic: 'Analyse de base',
    basicMore: 'En savoir plus',
    basicExplain:
      'Analyse de base : l’analyse approfondie n’est pas disponible. Les noms, numéros et coordonnées sont protégés, mais certaines mentions indirectes (fonctions, liens de parenté) peuvent ne pas être repérées.',
    collapse: 'Replier le volet',
    expand: 'Déplier le volet Protection',
  },

  review: {
    title: 'Vérifier avant d’envoyer',
    progress: (done: number, total: number) => `${done} sur ${total} vérifiés`,
    toVerify: 'Points de vigilance',
    autoProtected: 'Protégé automatiquement',
    protect: 'Protéger',
    ignore: 'Ignorer',
    linkTo: 'Relier à…',
    messageTab: 'Message',
    waitTitle: 'Analyse approfondie en cours',
    waitText: 'Votre texte est analysé sur votre ordinateur pour repérer les mentions indirectes. Vous pouvez attendre, ou passer en analyse de base : seuls les noms, numéros et coordonnées seront alors protégés automatiquement.',
    linkChoose: 'Relier à quel élément ?',
    linkOptional: 'Relier à un élément existant (facultatif)',
    linkNone: 'Nouvel élément',
    sourceRegex: 'Repéré automatiquement',
    sourceVariant: (name: string) => `Variante de ${name}`,
    sourceVariantGeneric: 'Variante d’un élément protégé',
    sourceLlm: 'Suggéré par l’analyse approfondie',
    designates: (name: string) => `Désigne probablement ${name}`,
    conflict: 'Plusieurs personnes peuvent correspondre. Choisissez.',
    chooseCandidate: (name: string) => `Choisir ${name}`,
    continue: 'Envoyer',
    continueDisabled: 'Traitez d’abord les points à vérifier pour continuer.',
    cancel: 'Annuler',
    unprotect: 'Ne plus protéger',
    seeReceived: 'Ce que l’IA va recevoir',
    original: 'Votre texte',
    compare: 'Comparer',
    nothingToVerify: 'Aucun point à vérifier.',
    basicNotice:
      'Analyse de base : aucune suggestion de l’analyse approfondie. Relisez le document pour repérer d’éventuelles mentions indirectes.',
    protectSelection: 'Protéger cet élément',
    selectionFamily: 'Type',
    keys: 'P : protéger · I : ignorer · ↑ ↓ : naviguer',
    document: 'Document',
    deepRunning: 'Analyse approfondie en cours…',
    deepSkipped: 'Analyse approfondie abandonnée : poursuite en analyse de base.',
  },

  blocked: {
    banner: (value: string) =>
      `Envoi bloqué : le nom ${value} apparaît encore dans le message. Protégez-le ou supprimez-le pour continuer.`,
    bannerGeneric: 'Envoi bloqué : une information sensible apparaît encore dans le message. Protégez-la ou supprimez-la pour continuer.',
    protect: 'Protéger',
    edit: 'Modifier le message',
  },

  errors: {
    assistantDown: "L'assistant ne répond pas. Votre message n'a pas été perdu. Réessayez.",
    assistantNotConfigured: "Aucun assistant n'est configuré sur ce poste.",
    internal: 'Une erreur est survenue. Votre message n’a pas été perdu.',
    dismiss: 'Fermer',
    retry: 'Réessayer',
  },

  file: {
    refused: (code: ErrorCode): string =>
      ({
        file_scanned_pdf: "Ce PDF est une image : il n'est pas possible d'en lire le texte pour le protéger. Il n'a pas été envoyé.",
        file_image: "Les images ne sont pas prises en charge pour le moment. Elles n'ont pas été envoyées.",
        file_encoding: "L'encodage de ce fichier n'est pas reconnu. Il n'a pas été envoyé.",
        file_too_large: 'Ce fichier est trop volumineux. Il n’a pas été envoyé.',
        file_unsupported: "Ce type de fichier n'est pas pris en charge. Il n'a pas été envoyé.",
        file_unreadable: "Ce fichier n'a pas pu être lu. Il n'a pas été envoyé.",
      })[code as string] ?? "Ce fichier n'a pas pu être traité. Il n'a pas été envoyé.",
    warning: (w: FileWarning): string => {
      switch (w.code) {
        case 'docx_comments':
        case 'docx_revisions':
          return "Ce document contient des commentaires ou des révisions qui n'ont pas été lus. Ils ne seront pas envoyés.";
        case 'docx_images':
        case 'pdf_images':
          return "Ce document contient des images qui n'ont pas été lues. Elles ne seront pas envoyées.";
        case 'pdf_pages_without_text':
          return `Les pages ${(w.pages ?? []).join(', ')} ne contiennent pas de texte lisible. Elles ne seront pas envoyées.`;
      }
    },
  },

  settings: {
    title: 'Paramètres',
    close: 'Fermer',
    sections: { assistant: 'Assistant IA', data: 'Données', appearance: 'Apparence', account: 'Compte' },
    assistantHelp: 'Choisissez l’assistant qui répond dans cette conversation.',
    dataClear: 'Effacer cette conversation et ses correspondances',
    dataClearConfirm: 'Confirmer l’effacement',
    dataNote: 'Tout est effacé à la fermeture de l’application.',
    themeLight: 'Clair',
    themeDark: 'Sombre',
    themeSystem: 'Selon l’ordinateur',
    accountFirm: 'Cabinet',
    accountEmail: 'Adresse e-mail',
    accountEdit: 'Modifier le profil',
    accountSignOut: 'Se déconnecter',
  },

  startup: {
    preparing: 'Préparation de l’analyse sur votre ordinateur',
    integrity: 'Vérification de l’intégrité du modèle en cours.',
    continueBasic: "Continuer avec l'analyse de base",
    continueBasicHelp: 'Les noms, numéros et coordonnées restent protégés ; certaines mentions indirectes peuvent ne pas être repérées.',
    start: 'Commencer',
  },

  tasks: {
    summary: { label: 'Résumé de dossier', prompt: 'Résume ce dossier : parties, objet du litige, points clés et état de la procédure.' },
    timeline: { label: 'Chronologie des faits', prompt: 'Établis la chronologie des faits, date par date, à partir des documents transmis.' },
    contradictions: { label: 'Relevé des contradictions', prompt: 'Relève les contradictions entre les déclarations ou les documents transmis, en citant chaque passage concerné.' },
  },

  about: {
    title: 'À propos',
    version: 'Version de démonstration',
    note: 'Prototype réalisé pour le Challenge Projets d’Entreprendre 2026. Les comptes et le serveur sont des maquettes.',
  },
};

/** Mots à ne jamais afficher (docs/UI_UX.md, §6.1). Utilisé par les tests. */
export const FORBIDDEN_WORDS = ['API', 'LLM', 'regex', 'token', 'JSON', 'placeholder', 'anonymisation', 'pseudonymisation'];
