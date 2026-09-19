<?php
/**
 * Configuration de l'API — copier ce fichier en config.php et l'adapter.
 * config.php n'est jamais versionné (voir .gitignore).
 */
return [
    'app' => [
        // 'developpement' affiche le détail des erreurs ; 'production' les masque.
        'env' => 'production',
        // Préfixe de l'API dans l'URL. null = détection automatique (/api sur cPanel).
        'base_path' => null,
        // Origines autorisées à appeler l'API avec les cookies de session
        // (utile uniquement en développement, quand Vite tourne sur un autre port).
        'origines_autorisees' => [
            'http://localhost:5173',
            'http://127.0.0.1:5173',
        ],
        // Adresse publique du site, sans « / » final. SasPay y renvoie le
        // client après paiement : https://darou-minane.xo.je en production.
        'url_publique' => 'https://darou-minane.xo.je',
    ],

    'db' => [
        'host'         => 'localhost',
        'port'         => 3306,
        'socket'       => null,           // renseigner pour se connecter par socket Unix
        'nom'          => 'darou_minane',
        'utilisateur'  => 'root',
        'mot_de_passe' => '',
    ],

    'boutique' => [
        'nom'            => 'Darou Minane',
        'slogan'         => 'Groupe Business Communication 626',
        // Numéro WhatsApp du propriétaire, format international sans + ni espaces.
        // Utilisé pour construire les liens wa.me (voir lib/Notifier.php).
        'whatsapp'       => '221773385535',
        'zone_livraison' => 'Tambacounda et environs',
        'devise'         => 'FCFA',
    ],

    'uploads' => [
        'dossier'        => __DIR__ . '/uploads',
        'url_publique'   => '/api/uploads',
        'largeur_max'    => 1200,          //   px — les images plus larges sont redimensionnées
        'qualite'        => 82,
        'taille_max'     => 6 * 1024 * 1024, // 6 Mo par fichier
        'fichiers_max'   => 6,             // par envoi
    ],

    'paiement' => [
        // SasPay (https://app.saspay.me) : Wave, Orange Money, Free Money.
        'saspay' => [
            // Clé secrète, section Développeur du tableau de bord SasPay :
            // sk_test_… pour essayer sans argent réel, sk_live_… pour
            // encaisser. Vide = pas de paiement mobile : la boutique ne
            // propose alors que le paiement à la livraison.
            'cle_api'          => '',
            // SasPay exige un e-mail client (pour le reçu). Celui-ci est
            // envoyé quand le client n'en donne pas : mettez celui de la boutique.
            'email_par_defaut' => '',
        ],
    ],

    'securite' => [
        'nom_session'          => 'darou_session',
        'duree_session'        => 8 * 3600, // 8 h
        'tentatives_max'       => 8,        // connexions ratées avant blocage
        'duree_blocage'        => 900,      // 15 min
    ],
];
