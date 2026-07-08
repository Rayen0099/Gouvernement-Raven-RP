const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, 
        ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, 
        ButtonBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder,
        StringSelectMenuOptionBuilder, PermissionFlagsBits, ChannelType,
        Collection, Events, Message } = require('discord.js');
const fs = require('fs');
const config = require('./config.json');

// Initialize client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages
    ]
});

// Database handling
let db = require('./database.json');

// Save database function
function saveDatabase() {
    fs.writeFileSync('./database.json', JSON.stringify(db, null, 2));
}

// Helper function to generate dossier number
function generateDossierNumber(faction) {
    db.dossierCounter[faction] = (db.dossierCounter[faction] || 0) + 1;
    const number = String(db.dossierCounter[faction]).padStart(3, '0');
    saveDatabase();
    return `${faction}-${number}`;
}

// Helper function to check permissions
function hasPermission(interaction, requiredRole) {
    const role = config.roles[requiredRole];
    if (!role) return false;
    return interaction.member.roles.cache.has(role);
}

// ==================== COMMAND REGISTRATION ====================

const commands = [
    new SlashCommandBuilder()
        .setName('concour')
        .setDescription('Créer un nouveau concours (Admin seulement)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    new SlashCommandBuilder()
        .setName('chercher-dossier')
        .setDescription('Rechercher un dossier par numéro')
        .addStringOption(option =>
            option.setName('faction')
                .setDescription('Sélectionnez la faction')
                .setRequired(true)
                .addChoices(
                    { name: 'SAMU', value: 'SAMU' },
                    { name: 'Police Nationale', value: 'Police Nationale' },
                    { name: 'Protection Civile', value: 'Protection Civile' },
                    { name: 'Transport', value: 'Transport' }
                ))
        .addStringOption(option =>
            option.setName('numero')
                .setDescription('Numéro du dossier (ex: SAMU-001)')
                .setRequired(true)),

    new SlashCommandBuilder()
        .setName('status-dossier')
        .setDescription('Changer le statut d\'un dossier')
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
        .setDescription('Créer un rappel pour une faction'),

    new SlashCommandBuilder()
        .setName('aide')
        .setDescription('Afficher l\'aide du bot')
];

// ==================== CLIENT READY ====================

client.once('ready', async () => {
    console.log(`✅ Bot connecté en tant que ${client.user.tag}`);

    // Register commands
    const rest = new REST({ version: '10' }).setToken(config.token);
    try {
        await rest.put(
            Routes.applicationGuildCommands(client.user.id, config.guildId),
            { body: commands.map(cmd => cmd.toJSON()) }
        );
        console.log('✅ Commandes enregistrées avec succès');
    } catch (error) {
        console.error('❌ Erreur lors de l\'enregistrement des commandes:', error);
    }
});

// ==================== INTERACTION HANDLER ====================

client.on(Events.InteractionCreate, async (interaction) => {
    if (interaction.isChatInputCommand()) {
        await handleCommand(interaction);
    } else if (interaction.isModalSubmit()) {
        await handleModal(interaction);
    } else if (interaction.isButton()) {
        await handleButton(interaction);
    } else if (interaction.isStringSelectMenu()) {
        await handleSelectMenu(interaction);
    }
});

// ==================== COMMAND HANDLERS ====================

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

// ==================== /CONCOUR COMMAND ====================

async function handleConcour(interaction) {
    // Permission check
    if (!hasPermission(interaction, 'admin')) {
        return interaction.reply({
            content: '❌ Vous n\'avez pas la permission d\'utiliser cette commande.',
            ephemeral: true
        });
    }

    // Create modal
    const modal = new ModalBuilder()
        .setCustomId('concour_modal')
        .setTitle('📢 Créer un nouveau concours');

    // Faction select menu
    const factionSelect = new StringSelectMenuBuilder()
        .setCustomId('faction_select')
        .setPlaceholder('Sélectionnez une faction')
        .addOptions(
            config.factions.map(f => ({
                label: f,
                value: f,
                emoji: f === 'SAMU' ? '🚑' : 
                       f === 'Police Nationale' ? '👮' :
                       f === 'Protection Civile' ? '🛡️' : '🚌'
            }))
        );

    const row1 = new ActionRowBuilder().addComponents(factionSelect);

    // Other fields
    const dateInput = new TextInputBuilder()
        .setCustomId('date')
        .setLabel('📅 Date du concours')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('ex: 15/12/2024')
        .setRequired(true);

    const timeInput = new TextInputBuilder()
        .setCustomId('time')
        .setLabel('⏰ Heure du concours')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('ex: 20:00')
        .setRequired(true);

    const locationInput = new TextInputBuilder()
        .setCustomId('location')
        .setLabel('📍 Lieu')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('ex: Préfecture de Police')
        .setRequired(true);

    const docsInput = new TextInputBuilder()
        .setCustomId('documents')
        .setLabel('📋 Documents requis')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Listez les documents nécessaires...')
        .setRequired(true);

    const imageInput = new TextInputBuilder()
        .setCustomId('image')
        .setLabel('🖼️ URL de l\'image')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('https://example.com/image.png')
        .setRequired(false);

    // Add components to modal
    modal.addComponents(
        row1,
        new ActionRowBuilder().addComponents(dateInput),
        new ActionRowBuilder().addComponents(timeInput),
        new ActionRowBuilder().addComponents(locationInput),
        new ActionRowBuilder().addComponents(docsInput),
        new ActionRowBuilder().addComponents(imageInput)
    );

    await interaction.showModal(modal);
}

// ==================== CONCOUR MODAL HANDLER ====================

async function handleConcourSubmit(interaction) {
    const faction = interaction.fields.getTextInputValue('faction_select') || 
                    interaction.components[0].components[0].value;
    const date = interaction.fields.getTextInputValue('date');
    const time = interaction.fields.getTextInputValue('time');
    const location = interaction.fields.getTextInputValue('location');
    const documents = interaction.fields.getTextInputValue('documents');
    const imageUrl = interaction.fields.getTextInputValue('image');

    // Create embed
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
        .setFooter({ text: 'Gouvernement Raven RP • Concours' })
        .setTimestamp();

    if (imageUrl) {
        embed.setImage(imageUrl);
    }

    // Create button
    const button = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`candidature_${faction}`)
            .setLabel('📝 Déposer mon dossier')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('📝')
    );

    // Send to concours channel
    const channel = await client.channels.fetch(config.channels.concours);
    const message = await channel.send({
        content: '@everyone',
        embeds: [embed],
        components: [button]
    });

    await interaction.reply({
        content: '✅ Concours créé avec succès !',
        ephemeral: true
    });
}

// ==================== CANDIDATE SYSTEM (BUTTON HANDLER) ====================

async function handleCandidateButton(interaction) {
    const faction = interaction.customId.replace('candidature_', '');

    // Create modal
    const modal = new ModalBuilder()
        .setCustomId(`candidature_modal_${faction}`)
        .setTitle('📝 Déposer ma candidature');

    // Create fields
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

// ==================== CANDIDATURE MODAL HANDLER ====================

async function handleCandidatureSubmit(interaction) {
    const faction = interaction.customId.replace('candidature_modal_', '');
    
    // Extract all fields
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

    // Generate dossier number
    const dossierNumber = generateDossierNumber(faction);
    data.dossierNumber = dossierNumber;

    // Save to database
    db.dossiers.push(data);
    saveDatabase();

    // Send confirmation DM
    try {
        const dmEmbed = new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle('✅ Dossier soumis avec succès')
            .setDescription(`Votre dossier pour **${faction}** a été enregistré.`)
            .addFields(
                { name: '📋 Numéro de dossier', value: dossierNumber, inline: true },
                { name: '📅 Date de soumission', value: new Date().toLocaleDateString(), inline: true },
                { name: '📊 Statut', value: '📋 En attente', inline: true },
                { name: 'ℹ️ Informations', value: 'Vous recevrez une notification lorsque votre dossier sera traité.' }
            )
            .setFooter({ text: 'Gouvernement Raven RP' })
            .setTimestamp();

        await interaction.user.send({ embeds: [dmEmbed] });
    } catch (error) {
        console.log('Impossible d\'envoyer un DM au joueur');
    }

    // Send admin notification
    const adminChannel = await client.channels.fetch(config.channels.adminNotifications);
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
        .setFooter({ text: 'Gouvernement Raven RP • Administration' })
        .setTimestamp();

    await adminChannel.send({ 
        content: `📬 Nouveau dossier de ${data.prenom} ${data.nom} pour ${faction}`,
        embeds: [adminEmbed] 
    });

    await interaction.reply({
        content: `✅ Votre dossier a été soumis avec succès !\nNuméro: **${dossierNumber}**\nUn administrateur va traiter votre demande.`,
        ephemeral: true
    });
}

// ==================== /CHERCHER-DOSSIER COMMAND ====================

async function handleChercherDossier(interaction) {
    if (!hasPermission(interaction, 'factionLeader')) {
        return interaction.reply({
            content: '❌ Vous n\'avez pas la permission d\'utiliser cette commande.',
            ephemeral: true
        });
    }

    const faction = interaction.options.getString('faction');
    const numero = interaction.options.getString('numero').toUpperCase();

    // Search dossier
    const dossier = db.dossiers.find(d => 
        d.dossierNumber === numero && d.faction === faction
    );

    if (!dossier) {
        return interaction.reply({
            content: `❌ Aucun dossier trouvé avec le numéro **${numero}** pour la faction **${faction}**.`,
            ephemeral: true
        });
    }

    const statusMap = {
        'Pending': '📋 En attente',
        'Convocation': '📞 Convocation',
        'Accepted': '✅ Accepté',
        'Refused': '❌ Refusé'
    };

    const embed = new EmbedBuilder()
        .setColor('#00BFFF')
        .setTitle(`📋 Dossier ${dossier.dossierNumber}`)
        .addFields(
            { name: '🏛️ Faction', value: dossier.faction, inline: true },
            { name: '📊 Statut', value: statusMap[dossier.status] || dossier.status, inline: true },
            { name: '👤 Nom complet', value: `${dossier.prenom} ${dossier.nom}`, inline: false },
            { name: '🎂 Âge', value: dossier.age, inline: true },
            { name: '📱 Téléphone', value: dossier.telephone, inline: true },
            { name: '🏠 Adresse', value: dossier.adresse, inline: false },
            { name: '💼 Expérience', value: dossier.experience, inline: false },
            { name: '❤️ Motivation', value: dossier.motivation, inline: false },
            { name: '🏛️ Ancienne faction', value: dossier.ancienne_faction || 'Aucune', inline: true },
            { name: '📄 Permis', value: dossier.permis, inline: true },
            { name: '🆔 Discord', value: `<@${dossier.discordId}>`, inline: true },
            { name: '📅 Date de soumission', value: new Date(dossier.date).toLocaleDateString(), inline: true }
        )
        .setFooter({ text: 'Gouvernement Raven RP • Dossier' })
        .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
}

// ==================== /STATUS-DOSSIER COMMAND ====================

async function handleStatusDossier(interaction) {
    if (!hasPermission(interaction, 'staff')) {
        return interaction.reply({
            content: '❌ Vous n\'avez pas la permission d\'utiliser cette commande.',
            ephemeral: true
        });
    }

    const numero = interaction.options.getString('numero').toUpperCase();
    const newStatus = interaction.options.getString('statut');
    const motif = interaction.options.getString('motif') || '';

    // Find dossier
    const dossierIndex = db.dossiers.findIndex(d => d.dossierNumber === numero);
    if (dossierIndex === -1) {
        return interaction.reply({
            content: `❌ Aucun dossier trouvé avec le numéro **${numero}**.`,
            ephemeral: true
        });
    }

    const oldStatus = db.dossiers[dossierIndex].status;
    db.dossiers[dossierIndex].status = newStatus;
    saveDatabase();

    const statusMap = {
        'Pending': '📋 En attente',
        'Convocation': '📞 Convocation',
        'Accepted': '✅ Accepté',
        'Refused': '❌ Refusé'
    };

    // Notify candidate via DM
    try {
        const user = await client.users.fetch(db.dossiers[dossierIndex].discordId);
        const dmEmbed = new EmbedBuilder()
            .setColor(newStatus === 'Accepted' ? '#00FF00' : 
                     newStatus === 'Refused' ? '#FF0000' : '#FFA500')
            .setTitle(`📬 Mise à jour de votre dossier ${numero}`)
            .addFields(
                { name: '📊 Nouveau statut', value: statusMap[newStatus], inline: true },
                { name: '📋 Ancien statut', value: statusMap[oldStatus], inline: true }
            )
            .setFooter({ text: 'Gouvernement Raven RP' })
            .setTimestamp();

        if (motif) {
            dmEmbed.addFields({ name: '💬 Motif', value: motif });
        }

        await user.send({ embeds: [dmEmbed] });
    } catch (error) {
        console.log('Impossible d\'envoyer la notification au joueur');
    }

    await interaction.reply({
        content: `✅ Statut du dossier **${numero}** mis à jour vers **${statusMap[newStatus]}**`,
        ephemeral: true
    });
}

// ==================== /REMIND COMMAND ====================

async function handleRemind(interaction) {
    if (!hasPermission(interaction, 'staff')) {
        return interaction.reply({
            content: '❌ Vous n\'avez pas la permission d\'utiliser cette commande.',
            ephemeral: true
        });
    }

    const modal = new ModalBuilder()
        .setCustomId('remind_modal')
        .setTitle('⏰ Créer un rappel');

    const factionSelect = new StringSelectMenuBuilder()
        .setCustomId('faction_select')
        .setPlaceholder('Sélectionnez une faction')
        .addOptions(
            config.factions.map(f => ({
                label: f,
                value: f,
                emoji: f === 'SAMU' ? '🚑' : 
                       f === 'Police Nationale' ? '👮' :
                       f === 'Protection Civile' ? '🛡️' : '🚌'
            }))
        );

    const row1 = new ActionRowBuilder().addComponents(factionSelect);

    const timeInput = new TextInputBuilder()
        .setCustomId('time')
        .setLabel('⏰ Temps restant')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('ex: 2 heures, 30 minutes...')
        .setRequired(true);

    const messageInput = new TextInputBuilder()
        .setCustomId('message')
        .setLabel('💬 Message (optionnel)')
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
        .setTitle('⏰ Rappel')
        .setDescription(`**${faction}** - Rappel important`)
        .addFields(
            { name: '⏳ Temps restant', value: time, inline: true },
            { name: '🏛️ Faction', value: faction, inline: true }
        )
        .setFooter({ text: 'Gouvernement Raven RP • Rappel' })
        .setTimestamp();

    if (message) {
        embed.addFields({ name: '💬 Message', value: message });
    }

    const channel = await client.channels.fetch(config.channels.general);
    await channel.send({
        content: `@everyone ⏰ Rappel pour **${faction}**`,
        embeds: [embed]
    });

    await interaction.reply({
        content: '✅ Rappel créé avec succès !',
        ephemeral: true
    });
}

// ==================== /AIDE COMMAND ====================

async function handleAide(interaction) {
    const embed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle('🤖 Gouvernement Raven RP • Aide')
        .setDescription('Bienvenue sur le bot d\'administration du Gouvernement Raven RP !')
        .addFields(
            { name: '🎯 **Objectif du bot**', value: 'Ce bot est dédié à la gestion administrative et aux recrutements. Le rôleplay se déroule exclusivement sur MTA.', inline: false },
            { name: '📋 **Système de candidature**', value: 'Les joueurs peuvent déposer leur dossier via les concours. Chaque dossier reçoit un numéro unique et est suivi par les administrateurs.', inline: false },
            { name: '🔐 **Permissions**', value: '• `Admin` - Gestion complète\n• `Staff` - Gestion des dossiers\n• `Faction Leader` - Consultation des dossiers', inline: false }
        )
        .setFooter({ text: 'Gouvernement Raven RP • v1.0' })
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

// ==================== HELP BUTTON HANDLERS ====================

async function handleHelpCommands(interaction) {
    const embed = new EmbedBuilder()
        .setColor('#00BFFF')
        .setTitle('📢 Commandes disponibles')
        .addFields(
            { name: '**/concour**', value: 'Créer un nouveau concours (Admin)', inline: false },
            { name: '**/chercher-dossier**', value: 'Rechercher un dossier (Faction Leader)', inline: false },
            { name: '**/status-dossier**', value: 'Changer le statut d\'un dossier (Staff)', inline: false },
            { name: '**/remind**', value: 'Créer un rappel (Staff)', inline: false },
            { name: '**/aide**', value: 'Afficher ce menu d\'aide', inline: false }
        )
        .setFooter({ text: 'Gouvernement Raven RP' })
        .setTimestamp();

    await interaction.update({ embeds: [embed] });
}

async function handleHelpDossiers(interaction) {
    const embed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('📂 Système de dossiers')
        .addFields(
            { name: '📝 **Déposer un dossier**', value: 'Cliquez sur "Déposer mon dossier" dans un concours.', inline: false },
            { name: '🔢 **Numéro de dossier**', value: 'Chaque dossier reçoit un numéro unique comme SAMU-001', inline: false },
            { name: '📊 **Statuts possibles**', value: '• 📋 En attente\n• 📞 Convocation\n• ✅ Accepté\n• ❌ Refusé', inline: false },
            { name: '📬 **Notifications**', value: 'Vous recevrez une notification par DM lors des changements de statut.', inline: false }
        )
        .setFooter({ text: 'Gouvernement Raven RP' })
        .setTimestamp();

    await interaction.update({ embeds: [embed] });
}

async function handleHelpPermissions(interaction) {
    const embed = new EmbedBuilder()
        .setColor('#FFA500')
        .setTitle('🔐 Permissions')
        .addFields(
            { name: '👑 **Admin**', value: '• /concour\n• Accès complet', inline: false },
            { name: '👔 **Staff**', value: '• /status-dossier\n• /remind\n• Gestion des dossiers', inline: false },
            { name: '📋 **Faction Leader**', value: '• /chercher-dossier\n• Consultation des dossiers', inline: false },
            { name: '👤 **Membre**', value: '• /aide\n• Déposer des candidatures\n• Recevoir des notifications', inline: false }
        )
        .setFooter({ text: 'Gouvernement Raven RP' })
        .setTimestamp();

    await interaction.update({ embeds: [embed] });
}

async function handleHelpAbout(interaction) {
    const embed = new EmbedBuilder()
        .setColor('#9B59B6')
        .setTitle('🤖 À propos du bot')
        .addFields(
            { name: '📌 **Version**', value: '1.0.0', inline: true },
            { name: '🏛️ **Serveur**', value: 'Gouvernement Raven RP', inline: true },
            { name: '📅 **Créé**', value: new Date().toLocaleDateString(), inline: true },
            { name: '🎯 **Mission**', value: 'Faciliter la gestion administrative et les recrutements du serveur MTA Raven RP.', inline: false },
            { name: '💻 **Technologie**', value: '• Node.js\n• Discord.js v14\n• Base de données JSON', inline: false }
        )
        .setFooter({ text: 'Gouvernement Raven RP' })
        .setTimestamp();

    await interaction.update({ embeds: [embed] });
}

// ==================== MODAL HANDLER ====================

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

// ==================== BUTTON HANDLER ====================

async function handleButton(interaction) {
    const customId = interaction.customId;

    if (customId.startsWith('candidature_')) {
        await handleCandidateButton(interaction);
    } else if (customId === 'help_commands') {
        await handleHelpCommands(interaction);
    } else if (customId === 'help_dossiers') {
        await handleHelpDossiers(interaction);
    } else if (customId === 'help_permissions') {
        await handleHelpPermissions(interaction);
    } else if (customId === 'help_about') {
        await handleHelpAbout(interaction);
    }
}

// ==================== SELECT MENU HANDLER ====================

async function handleSelectMenu(interaction) {
    // This is handled in the modal submission
}

// ==================== ERROR HANDLING ====================

client.on(Events.Error, (error) => {
    console.error('❌ Une erreur est survenue:', error);
});

process.on('unhandledRejection', (error) => {
    console.error('❌ Promesse non gérée:', error);
});

// ==================== BOT LOGIN ====================

client.login(config.token);

console.log('🚀 Bot Gouvernement Raven RP en cours de démarrage...');
console.log('📝 Configuration:');
console.log(`   - Serveur ID: ${config.guildId}`);
console.log(`   - Channels configurés: ${Object.keys(config.channels).length}`);
console.log(`   - Rôles configurés: ${Object.keys(config.roles).length}`);
console.log(`   - Factions: ${config.factions.join(', ')}`);
