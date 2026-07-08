// ============================================
// 🇹🇳 GOUVERNEMENT RAVEN RP - BOT DISCORD
// ============================================
// Système d'administration pour serveur MTA Roleplay Tunisien
// Discord.js v14 - Prêt pour Render
// ============================================

// ============================================
// IMPORTS
// ============================================
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder,
        ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder,
        ButtonBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder,
        PermissionFlagsBits, Events } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config(); // Chargement des variables d'environnement

// ============================================
// VALIDATION DES VARIABLES D'ENVIRONNEMENT
// ============================================
function validateEnvVariables() {
    const required = [
        'TOKEN',
        'CLIENT_ID',
        'GUILD_ID',
        'CONCOURS_CHANNEL',
        'ADMIN_NOTIFICATIONS_CHANNEL',
        'GENERAL_CHANNEL',
        'ADMIN_ROLE',
        'FACTION_LEADER_ROLE',
        'STAFF_ROLE'
    ];

    const missing = required.filter(env => !process.env[env]);

    if (missing.length > 0) {
        console.error('❌ ERREUR CRITIQUE : Variables d\'environnement manquantes :');
        missing.forEach(env => console.error(`   - ${env}`));
        console.error('\n📋 Veuillez configurer toutes les variables dans .env ou Render Dashboard');
        console.error('📝 Référez-vous à .env.example pour la liste complète');
        process.exit(1);
    }

    console.log('✅ Toutes les variables d\'environnement sont présentes');
}

// Exécuter la validation immédiatement
validateEnvVariables();

// ============================================
// CONFIGURATION
// ============================================
const config = require('./config.json');

// Configuration depuis les variables d'environnement
const ENV = {
    TOKEN: process.env.TOKEN,
    CLIENT_ID: process.env.CLIENT_ID,
    GUILD_ID: process.env.GUILD_ID,
    CHANNELS: {
        CONCOURS: process.env.CONCOURS_CHANNEL,
        ADMIN_NOTIFICATIONS: process.env.ADMIN_NOTIFICATIONS_CHANNEL,
        GENERAL: process.env.GENERAL_CHANNEL
    },
    ROLES: {
        ADMIN: process.env.ADMIN_ROLE,
        FACTION_LEADER: process.env.FACTION_LEADER_ROLE,
        STAFF: process.env.STAFF_ROLE
    }
};

// ============================================
// CLIENT DISCORD
// ============================================
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages
    ]
});

// ============================================
// BASE DE DONNÉES
// ============================================
const DB_PATH = path.join(__dirname, 'database.json');
let db = require(DB_PATH);

function saveDatabase() {
    try {
        fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
    } catch (error) {
        console.error('❌ Erreur lors de la sauvegarde de la base de données:', error);
    }
}

// ============================================
// FONCTIONS UTILITAIRES
// ============================================

// Génération du numéro de dossier
function generateDossierNumber(faction) {
    db.dossierCounter[faction] = (db.dossierCounter[faction] || 0) + 1;
    const number = String(db.dossierCounter[faction]).padStart(3, '0');
    saveDatabase();
    return `${faction}-${number}`;
}

// Vérification des permissions
function hasPermission(interaction, requiredRole) {
    const roleId = ENV.ROLES[requiredRole];
    if (!roleId) return false;
    return interaction.member.roles.cache.has(roleId);
}

// Récupération du statut formaté
function getStatusInfo(status) {
    return {
        emoji: config.statusEmojis[status] || '📋',
        label: config.statusLabels[status] || status
    };
}

// ============================================
// COMMANDES SLASH
// ============================================
const commands = [
    new SlashCommandBuilder()
        .setName('concour')
        .setDescription('📢 Créer un nouveau concours (Admin seulement)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    new SlashCommandBuilder()
        .setName('chercher-dossier')
        .setDescription('🔍 Rechercher un dossier par numéro')
        .addStringOption(option =>
            option.setName('faction')
                .setDescription('Sélectionnez la faction')
                .setRequired(true)
                .addChoices(
                    ...config.factions.map(f => ({ name: f, value: f }))
                ))
        .addStringOption(option =>
            option.setName('numero')
                .setDescription('Numéro du dossier (ex: SAMU-001)')
                .setRequired(true)),

    new SlashCommandBuilder()
        .setName('status-dossier')
        .setDescription('📊 Changer le statut d\'un dossier')
        .addStringOption(option =>
            option.setName('numero')
                .setDescription('Numéro du dossier')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('statut')
                .setDescription('Nouveau statut')
                .setRequired(true)
                .addChoices(
                    { name: '📋 En attente', value: 'Pending' },
                    { name: '📞 Convocation', value: 'Convocation' },
                    { name: '✅ Accepté', value: 'Accepted' },
                    { name: '❌ Refusé', value: 'Refused' }
                ))
        .addStringOption(option =>
            option.setName('motif')
                .setDescription('Motif (optionnel)')
                .setRequired(false)),

    new SlashCommandBuilder()
        .setName('remind')
        .setDescription('⏰ Créer un rappel officiel'),

    new SlashCommandBuilder()
        .setName('aide')
        .setDescription('🤖 Afficher le centre d\'aide du Gouvernement Raven RP')
];

// ============================================
// ÉVÉNEMENT READY
// ============================================
client.once('ready', async () => {
    console.log('\n' + '='.repeat(50));
    console.log('🇹🇳 Gouvernement Raven RP est en ligne !');
    console.log('='.repeat(50));
    console.log(`🤖 Bot : ${client.user.tag}`);
    console.log(`📡 Serveur : ${client.guilds.cache.size} serveurs`);
    console.log(`👥 Utilisateurs : ${client.users.cache.size} utilisateurs`);
    console.log(`📋 Factions configurées : ${config.factions.join(', ')}`);
    console.log('='.repeat(50) + '\n');

    // Enregistrement des commandes
    const rest = new REST({ version: '10' }).setToken(ENV.TOKEN);
    try {
        console.log('🔄 Enregistrement des commandes slash...');
        await rest.put(
            Routes.applicationGuildCommands(ENV.CLIENT_ID, ENV.GUILD_ID),
            { body: commands.map(cmd => cmd.toJSON()) }
        );
        console.log('✅ Commandes slash enregistrées avec succès !');
    } catch (error) {
        console.error('❌ Erreur lors de l\'enregistrement des commandes:', error);
    }

    // Vérification des channels
    console.log('\n📌 Vérification des channels :');
    const channels = {
        'CONCOURS_CHANNEL': ENV.CHANNELS.CONCOURS,
        'ADMIN_NOTIFICATIONS_CHANNEL': ENV.CHANNELS.ADMIN_NOTIFICATIONS,
        'GENERAL_CHANNEL': ENV.CHANNELS.GENERAL
    };

    for (const [name, id] of Object.entries(channels)) {
        try {
            const channel = await client.channels.fetch(id);
            console.log(`   ✅ ${name} : #${channel.name}`);
        } catch (error) {
            console.log(`   ⚠️ ${name} : ID invalide ou inaccessible`);
        }
    }
});

// ============================================
// GESTION DES INTERACTIONS
// ============================================
client.on(Events.InteractionCreate, async (interaction) => {
    try {
        if (interaction.isChatInputCommand()) {
            await handleCommand(interaction);
        } else if (interaction.isModalSubmit()) {
            await handleModal(interaction);
        } else if (interaction.isButton()) {
            await handleButton(interaction);
        } else if (interaction.isStringSelectMenu()) {
            await handleSelectMenu(interaction);
        }
    } catch (error) {
        console.error('❌ Erreur lors du traitement de l\'interaction:', error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
                content: '❌ Une erreur est survenue. Veuillez réessayer.',
                flags: 64 // Éphémère
            });
        }
    }
});

// ============================================
// COMMANDE /CONCOUR
// ============================================
async function handleConcour(interaction) {
    if (!hasPermission(interaction, 'ADMIN')) {
        return interaction.reply({
            content: '❌ Vous n\'avez pas la permission d\'utiliser cette commande.',
            flags: 64
        });
    }

    const modal = new ModalBuilder()
        .setCustomId('concour_modal')
        .setTitle('📢 Créer un nouveau concours');

    // Sélecteur de faction
    const factionSelect = new StringSelectMenuBuilder()
        .setCustomId('faction_select')
        .setPlaceholder('Sélectionnez une faction')
        .addOptions(
            config.factions.map(f => ({
                label: f,
                value: f,
                emoji: config.factionEmojis[f] || '🏛️'
            }))
        );

    const row1 = new ActionRowBuilder().addComponents(factionSelect);

    // Champs du formulaire
    const fields = [
        { id: 'date', label: '📅 Date du concours', style: TextInputStyle.Short, placeholder: 'ex: 15/12/2024' },
        { id: 'time', label: '⏰ Heure du concours', style: TextInputStyle.Short, placeholder: 'ex: 20:00' },
        { id: 'location', label: '📍 Lieu', style: TextInputStyle.Short, placeholder: 'ex: Préfecture de Police' },
        { id: 'documents', label: '📋 Documents requis', style: TextInputStyle.Paragraph, placeholder: 'Listez les documents nécessaires...' },
        { id: 'image', label: '🖼️ URL de l\'image', style: TextInputStyle.Short, placeholder: 'https://example.com/image.png', required: false }
    ];

    modal.addComponents(row1);

    fields.forEach(field => {
        const input = new TextInputBuilder()
            .setCustomId(field.id)
            .setLabel(field.label)
            .setStyle(field.style)
            .setPlaceholder(field.placeholder)
            .setRequired(field.required !== false);
        modal.addComponents(new ActionRowBuilder().addComponents(input));
    });

    await interaction.showModal(modal);
}

async function handleConcourSubmit(interaction) {
    const faction = interaction.fields.getTextInputValue('faction_select') || 
                    interaction.components[0].components[0].value;
    const date = interaction.fields.getTextInputValue('date');
    const time = interaction.fields.getTextInputValue('time');
    const location = interaction.fields.getTextInputValue('location');
    const documents = interaction.fields.getTextInputValue('documents');
    const imageUrl = interaction.fields.getTextInputValue('image');

    const embed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle(`📢 Concours - ${faction}`)
        .setDescription(`La faction **${faction}** organise un concours !`)
        .addFields(
            { name: '📅 Date', value: date, inline: true },
            { name: '⏰ Heure', value: time, inline: true },
            { name: '📍 Lieu', value: location, inline: false },
            { name: '📋 Documents requis', value: documents, inline: false }
        )
        .setFooter({ text: `${config.botName} • Concours` })
        .setTimestamp();

    if (imageUrl) {
        embed.setImage(imageUrl);
    }

    const button = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`candidature_${faction}`)
            .setLabel('📝 Déposer mon dossier')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('📝')
    );

    const channel = await client.channels.fetch(ENV.CHANNELS.CONCOURS);
    await channel.send({
        content: '@everyone',
        embeds: [embed],
        components: [button]
    });

    await interaction.reply({
        content: '✅ Concours créé avec succès !',
        flags: 64
    });
}

// ============================================
// SYSTEME DE CANDIDATURE
// ============================================
async function handleCandidateButton(interaction) {
    const faction = interaction.customId.replace('candidature_', '');

    const modal = new ModalBuilder()
        .setCustomId(`candidature_modal_${faction}`)
        .setTitle('📝 Déposer ma candidature');

    const fields = [
        { id: 'nom', label: '👤 Nom RP', style: TextInputStyle.Short, placeholder: 'Votre nom de famille' },
        { id: 'prenom', label: '👤 Prénom RP', style: TextInputStyle.Short, placeholder: 'Votre prénom' },
        { id: 'age', label: '🎂 Âge RP', style: TextInputStyle.Short, placeholder: 'ex: 25' },
        { id: 'telephone', label: '📱 Téléphone RP', style: TextInputStyle.Short, placeholder: 'ex: 12345678' },
        { id: 'adresse', label: '🏠 Adresse RP', style: TextInputStyle.Short, placeholder: 'Votre adresse' },
        { id: 'experience', label: '💼 Expérience RP', style: TextInputStyle.Paragraph, placeholder: 'Décrivez votre expérience...' },
        { id: 'motivation', label: '❤️ Motivation', style: TextInputStyle.Paragraph, placeholder: 'Pourquoi voulez-vous rejoindre cette faction ?' },
        { id: 'ancienne_faction', label: '🏛️ Ancienne faction', style: TextInputStyle.Short, placeholder: 'Aucune si vous n\'en avez pas' },
        { id: 'permis', label: '📄 Permis', style: TextInputStyle.Short, placeholder: 'ex: B, A, C, etc.' }
    ];

    fields.forEach(field => {
        const input = new TextInputBuilder()
            .setCustomId(field.id)
            .setLabel(field.label)
            .setStyle(field.style)
            .setPlaceholder(field.placeholder)
            .setRequired(true);
        modal.addComponents(new ActionRowBuilder().addComponents(input));
    });

    await interaction.showModal(modal);
}

async function handleCandidatureSubmit(interaction) {
    const faction = interaction.customId.replace('candidature_modal_', '');
    
    const data = {
        faction: faction,
        nom: interaction.fields.getTextInputValue('nom'),
        prenom: interaction.fields.getTextInputValue('prenom'),
        age: interaction.fields.getTextInputValue('age'),
        telephone: interaction.fields.getTextInputValue('telephone'),
        adresse: interaction.fields.getTextInputValue('adresse'),
        experience: interaction.fields.getTextInputValue('experience'),
        motivation: interaction.fields.getTextInputValue('motivation'),
        ancienne_faction: interaction.fields.getTextInputValue('ancienne_faction'),
        permis: interaction.fields.getTextInputValue('permis'),
        status: 'Pending',
        date: new Date().toISOString(),
        discordId: interaction.user.id,
        discordTag: interaction.user.tag
    };

    const dossierNumber = generateDossierNumber(faction);
    data.dossierNumber = dossierNumber;

    db.dossiers.push(data);
    saveDatabase();

    // DM Confirmation
    try {
        const dmEmbed = new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle('✅ Dossier soumis avec succès')
            .setDescription(`Votre dossier pour **${faction}** a été enregistré.`)
            .addFields(
                { name: '📋 Numéro de dossier', value: dossierNumber, inline: true },
                { name: '📅 Date de soumission', value: new Date().toLocaleDateString(), inline: true },
                { name: '📊 Statut', value: '📋 En attente', inline: true }
            )
            .setFooter({ text: config.botName })
            .setTimestamp();

        await interaction.user.send({ embeds: [dmEmbed] });
    } catch (error) {
        console.log('⚠️ Impossible d\'envoyer un DM au joueur');
    }

    // Notification Admin
    const adminChannel = await client.channels.fetch(ENV.CHANNELS.ADMIN_NOTIFICATIONS);
    const adminEmbed = new EmbedBuilder()
        .setColor('#FFA500')
        .setTitle('📬 Nouveau dossier soumis')
        .addFields(
            { name: '🏛️ Faction', value: faction, inline: true },
            { name: '📋 Numéro', value: dossierNumber, inline: true },
            { name: '👤 Candidat', value: `${data.prenom} ${data.nom}`, inline: true },
            { name: '📊 Statut', value: '📋 En attente', inline: true },
            { name: '🆔 Discord', value: `<@${data.discordId}>`, inline: true }
        )
        .setFooter({ text: `${config.botName} • Administration` })
        .setTimestamp();

    await adminChannel.send({ 
        content: `📬 Nouveau dossier de ${data.prenom} ${data.nom} pour ${faction}`,
        embeds: [adminEmbed] 
    });

    await interaction.reply({
        content: `✅ Votre dossier a été soumis avec succès !\nNuméro: **${dossierNumber}**\nUn administrateur va traiter votre demande.`,
        flags: 64
    });
}

// ============================================
// COMMANDE /CHERCHER-DOSSIER
// ============================================
async function handleChercherDossier(interaction) {
    if (!hasPermission(interaction, 'FACTION_LEADER')) {
        return interaction.reply({
            content: '❌ Vous n\'avez pas la permission d\'utiliser cette commande.',
            flags: 64
        });
    }

    const faction = interaction.options.getString('faction');
    const numero = interaction.options.getString('numero').toUpperCase();

    const dossier = db.dossiers.find(d => 
        d.dossierNumber === numero && d.faction === faction
    );

    if (!dossier) {
        return interaction.reply({
            content: `❌ Aucun dossier trouvé avec le numéro **${numero}** pour la faction **${faction}**.`,
            flags: 64
        });
    }

    const statusInfo = getStatusInfo(dossier.status);

    const embed = new EmbedBuilder()
        .setColor('#00BFFF')
        .setTitle(`📋 Dossier ${dossier.dossierNumber}`)
        .addFields(
            { name: '🏛️ Faction', value: dossier.faction, inline: true },
            { name: '📊 Statut', value: `${statusInfo.emoji} ${statusInfo.label}`, inline: true },
            { name: '👤 Nom complet', value: `${dossier.prenom} ${dossier.nom}`, inline: false },
            { name: '🎂 Âge', value: dossier.age, inline: true },
            { name: '📱 Téléphone', value: dossier.telephone, inline: true },
            { name: '🏠 Adresse', value: dossier.adresse, inline: false },
            { name: '💼 Expérience', value: dossier.experience, inline: false },
            { name: '❤️ Motivation', value: dossier.motivation, inline: false },
            { name: '🏛️ Ancienne faction', value: dossier.ancienne_faction || 'Aucune', inline: true },
            { name: '📄 Permis', value: dossier.permis, inline: true },
            { name: '🆔 Discord', value: `<@${dossier.discordId}>`, inline: true },
            { name: '📅 Date', value: new Date(dossier.date).toLocaleDateString(), inline: true }
        )
        .setFooter({ text: `${config.botName} • Dossier` })
        .setTimestamp();

    await interaction.reply({ embeds: [embed], flags: 64 });
}

// ============================================
// COMMANDE /STATUS-DOSSIER
// ============================================
async function handleStatusDossier(interaction) {
    if (!hasPermission(interaction, 'STAFF')) {
        return interaction.reply({
            content: '❌ Vous n\'avez pas la permission d\'utiliser cette commande.',
            flags: 64
        });
    }

    const numero = interaction.options.getString('numero').toUpperCase();
    const newStatus = interaction.options.getString('statut');
    const motif = interaction.options.getString('motif') || '';

    const dossierIndex = db.dossiers.findIndex(d => d.dossierNumber === numero);
    if (dossierIndex === -1) {
        return interaction.reply({
            content: `❌ Aucun dossier trouvé avec le numéro **${numero}**.`,
            flags: 64
        });
    }

    const oldStatus = db.dossiers[dossierIndex].status;
    db.dossiers[dossierIndex].status = newStatus;
    saveDatabase();

    const statusInfo = getStatusInfo(newStatus);
    const oldStatusInfo = getStatusInfo(oldStatus);

    // Notification au candidat
    try {
        const user = await client.users.fetch(db.dossiers[dossierIndex].discordId);
        const dmEmbed = new EmbedBuilder()
            .setColor(newStatus === 'Accepted' ? '#00FF00' : 
                     newStatus === 'Refused' ? '#FF0000' : '#FFA500')
            .setTitle(`📬 Mise à jour de votre dossier ${numero}`)
            .addFields(
                { name: '📊 Nouveau statut', value: `${statusInfo.emoji} ${statusInfo.label}`, inline: true },
                { name: '📋 Ancien statut', value: `${oldStatusInfo.emoji} ${oldStatusInfo.label}`, inline: true }
            )
            .setFooter({ text: config.botName })
            .setTimestamp();

        if (motif) {
            dmEmbed.addFields({ name: '💬 Motif', value: motif });
        }

        await user.send({ embeds: [dmEmbed] });
    } catch (error) {
        console.log('⚠️ Impossible d\'envoyer la notification au joueur');
    }

    await interaction.reply({
        content: `✅ Statut du dossier **${numero}** mis à jour vers **${statusInfo.emoji} ${statusInfo.label}**`,
        flags: 64
    });
}

// ============================================
// COMMANDE /REMIND
// ============================================
async function handleRemind(interaction) {
    if (!hasPermission(interaction, 'STAFF')) {
        return interaction.reply({
            content: '❌ Vous n\'avez pas la permission d\'utiliser cette commande.',
            flags: 64
        });
    }

    const modal = new ModalBuilder()
        .setCustomId('remind_modal')
        .setTitle('⏰ Créer un rappel officiel');

    const factionSelect = new StringSelectMenuBuilder()
        .setCustomId('faction_select')
        .setPlaceholder('Sélectionnez une faction')
        .addOptions(
            config.factions.map(f => ({
                label: f,
                value: f,
                emoji: config.factionEmojis[f] || '🏛️'
            }))
        );

    const row1 = new ActionRowBuilder().addComponents(factionSelect);

    const timeInput = new TextInputBuilder()
        .setCustomId('time')
        .setLabel('⏳ Temps restant')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('ex: 30 minutes, 2 heures...')
        .setRequired(true);

    const messageInput = new TextInputBuilder()
        .setCustomId('message')
        .setLabel('💬 Message optionnel')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Informations supplémentaires...')
        .setRequired(false);

    modal.addComponents(
        row1,
        new ActionRowBuilder().addComponents(timeInput),
        new ActionRowBuilder().addComponents(messageInput)
    );

    await interaction.showModal(modal);
}

async function handleRemindSubmit(interaction) {
    const faction = interaction.fields.getTextInputValue('faction_select') || 
                    interaction.components[0].components[0].value;
    const time = interaction.fields.getTextInputValue('time');
    const message = interaction.fields.getTextInputValue('message') || '';

    const embed = new EmbedBuilder()
        .setColor('#FF6B00')
        .setTitle('🇹🇳 Gouvernement Raven RP')
        .setDescription(`🔔 **RAPPEL OFFICIEL**`)
        .addFields(
            { name: '🏛️ Faction', value: faction, inline: true },
            { name: '⏳ Temps restant', value: time, inline: true },
            { name: '📍 Action requise', value: 'Préparez vos documents et rendez-vous sur place.' }
        )
        .setFooter({ text: `${config.botName} • Rappel` })
        .setTimestamp();

    if (message) {
        embed.addFields({ name: '💬 Message', value: message });
    }

    const channel = await client.channels.fetch(ENV.CHANNELS.GENERAL);
    await channel.send({
        content: `@everyone ⏰ **Rappel** - ${faction}`,
        embeds: [embed]
    });

    await interaction.reply({
        content: '✅ Rappel créé avec succès !',
        flags: 64
    });
}

// ============================================
// COMMANDE /AIDE
// ============================================
async function handleAide(interaction) {
    const embed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle('🇹🇳 Gouvernement Raven RP')
        .setDescription('**Système administratif officiel de Raven Roleplay**')
        .addFields(
            { 
                name: '📌 **Présentation**', 
                value: 'Ce bot est le système administratif officiel de Raven Roleplay.\n\n' +
                       'Il permet :\n' +
                       '• 📢 Gestion des concours\n' +
                       '• 📋 Gestion des dossiers candidats\n' +
                       '• 🔔 Notifications administratives', 
                inline: false 
            },
            {
                name: '📝 **Commandes disponibles**',
                value: '`/concour` - Créer un concours officiel\n' +
                       '`/chercher-dossier` - Rechercher un dossier candidat\n' +
                       '`/status-dossier` - Modifier l\'état d\'un dossier\n' +
                       '`/remind` - Créer un rappel officiel\n' +
                       '`/aide` - Afficher le centre d\'aide',
                inline: false
            },
            {
                name: '💡 **Système de candidature**',
                value: '📌 **Discord** = Administration\n' +
                       '🎮 **MTA** = Roleplay\n\n' +
                       'Les candidatures se font via Discord, et le Roleplay se déroule exclusivement sur le serveur MTA Raven RP.',
                inline: false
            },
            {
                name: '🔐 **Permissions**',
                value: '👑 Admin - Toutes les commandes\n' +
                       '👔 Staff - Gestion des dossiers\n' +
                       '📋 Faction Leader - Consultation des dossiers\n' +
                       '👤 Membre - Dépôt de candidature',
                inline: false
            }
        )
        .setFooter({ text: `${config.botName} • v${config.version}` })
        .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('help_commands')
            .setLabel('📢 Commandes')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId('help_dossiers')
            .setLabel('📂 Dossiers')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId('help_permissions')
            .setLabel('🔐 Permissions')
            .setStyle(ButtonStyle.Warning),
        new ButtonBuilder()
            .setCustomId('help_about')
            .setLabel('🤖 À propos')
            .setStyle(ButtonStyle.Secondary)
    );

    await interaction.reply({ embeds: [embed], components: [row] });
}

// ============================================
// BOUTONS D'AIDE
// ============================================
async function handleHelpButtons(interaction) {
    const buttonId = interaction.customId;
    let embed;

    switch(buttonId) {
        case 'help_commands':
            embed = new EmbedBuilder()
                .setColor('#00BFFF')
                .setTitle('📢 Commandes disponibles')
                .addFields(
                    { name: '`/concour`', value: 'Créer un nouveau concours (Admin)', inline: false },
                    { name: '`/chercher-dossier`', value: 'Rechercher un dossier (Faction Leader)', inline: false },
                    { name: '`/status-dossier`', value: 'Changer le statut d\'un dossier (Staff)', inline: false },
                    { name: '`/remind`', value: 'Créer un rappel officiel (Staff)', inline: false },
                    { name: '`/aide`', value: 'Afficher ce menu d\'aide', inline: false }
                )
                .setFooter({ text: config.botName })
                .setTimestamp();
            break;

        case 'help_dossiers':
            embed = new EmbedBuilder()
                .setColor('#00FF00')
                .setTitle('📂 Système de dossiers')
                .addFields(
                    { name: '📝 Déposer un dossier', value: 'Cliquez sur "Déposer mon dossier" dans un concours.', inline: false },
                    { name: '🔢 Numéro de dossier', value: 'Format: SAMU-001, POL-001, PC-001', inline: false },
                    { name: '📊 Statuts possibles', value: '• 📋 En attente\n• 📞 Convocation\n• ✅ Accepté\n• ❌ Refusé', inline: false },
                    { name: '📬 Notifications', value: 'Vous recevez une notification par DM lors des changements de statut.', inline: false }
                )
                .setFooter({ text: config.botName })
                .setTimestamp();
            break;

        case 'help_permissions':
            embed = new EmbedBuilder()
                .setColor('#FFA500')
                .setTitle('🔐 Permissions')
                .addFields(
                    { name: '👑 Admin', value: '• `/concour`\n• Accès complet', inline: false },
                    { name: '👔 Staff', value: '• `/status-dossier`\n• `/remind`\n• Gestion des dossiers', inline: false },
                    { name: '📋 Faction Leader', value: '• `/chercher-dossier`\n• Consultation des dossiers', inline: false },
                    { name: '👤 Membre', value: '• `/aide`\n• Déposer des candidatures\n• Recevoir des notifications', inline: false }
                )
                .setFooter({ text: config.botName })
                .setTimestamp();
            break;

        case 'help_about':
            embed = new EmbedBuilder()
                .setColor('#9B59B6')
                .setTitle('🤖 À propos du bot')
                .addFields(
                    { name: '📌 Version', value: config.version, inline: true },
                    { name: '🏛️ Serveur', value: 'Gouvernement Raven RP', inline: true },
                    { name: '🌍 Pays', value: '🇹🇳 Tunisie', inline: true },
                    { name: '🎯 Mission', value: 'Faciliter la gestion administrative et les recrutements du serveur MTA Raven RP.', inline: false },
                    { name: '💻 Technologies', value: '• Node.js\n• Discord.js v14\n• Render Hosting', inline: false }
                )
                .setFooter({ text: `${config.botName} • v${config.version}` })
                .setTimestamp();
            break;
    }

    await interaction.update({ embeds: [embed] });
}

// ============================================
// GESTIONNAIRES CENTRALISÉS
// ============================================
async function handleCommand(interaction) {
    const commandName = interaction.commandName;

    switch (commandName) {
        case 'concour':
            await handleConcour(interaction);
            break;
        case 'chercher-dossier':
            await handleChercherDossier(interaction);
            break;
        case 'status-dossier':
            await handleStatusDossier(interaction);
            break;
        case 'remind':
            await handleRemind(interaction);
            break;
        case 'aide':
            await handleAide(interaction);
            break;
    }
}

async function handleModal(interaction) {
    const customId = interaction.customId;

    if (customId === 'concour_modal') {
        await handleConcourSubmit(interaction);
    } else if (customId.startsWith('candidature_modal_')) {
        await handleCandidatureSubmit(interaction);
    } else if (customId === 'remind_modal') {
        await handleRemindSubmit(interaction);
    }
}

async function handleButton(interaction) {
    const customId = interaction.customId;

    if (customId.startsWith('candidature_')) {
        await handleCandidateButton(interaction);
    } else if (['help_commands', 'help_dossiers', 'help_permissions', 'help_about'].includes(customId)) {
        await handleHelpButtons(interaction);
    }
}

async function handleSelectMenu(interaction) {
    // Les menus select sont gérés dans les modals
}

// ============================================
// GESTION DES ERREURS
// ============================================
client.on(Events.Error, (error) => {
    console.error('❌ Erreur Discord:', error);
});

process.on('unhandledRejection', (error) => {
    console.error('❌ Promesse non gérée:', error);
});

process.on('SIGINT', () => {
    console.log('\n👋 Arrêt du bot...');
    client.destroy();
    process.exit(0);
});

// ============================================
// LANCEMENT DU BOT
// ============================================
client.login(ENV.TOKEN);
