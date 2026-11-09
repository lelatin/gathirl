/* =====================================================================
   GATHIRL — configuration
   ---------------------------------------------------------------------
   Laissez SUPABASE_URL vide pour le MODE DÉMO : tout est stocké dans le
   navigateur (localStorage), avec des joueurs et des parties d'exemple.

   Pour passer en production (vrais comptes, messagerie partagée) :
   1. Créez un projet gratuit sur https://supabase.com
   2. Exécutez supabase/schema.sql dans l'éditeur SQL du projet
   3. Collez ci-dessous l'URL du projet et la clé "anon public"
      (Project Settings → API). Cette clé est publique par design :
      la sécurité est assurée par les règles RLS du schéma.
   ===================================================================== */

export const CONFIG = {
  SUPABASE_URL: "",
  SUPABASE_ANON_KEY: "",

  /* Rayon (km) de la section "Près de chez vous" */
  NEARBY_RADIUS_KM: 10,

  /* Activer "Continuer avec Google" (à configurer dans Supabase → Auth → Providers) */
  GOOGLE_AUTH: false,
};
