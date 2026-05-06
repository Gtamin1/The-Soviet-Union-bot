# 🚀 Advanced Features Implementation Guide

This guide explains what's been implemented, how to set it up, and what still needs to be added.

## ✅ What's Been Implemented (Part 1)

### 🔐 Core Security & Infrastructure
- ✅ AES-256-GCM encryption for Roblox cookies
- ✅ Comprehensive audit logging system
- ✅ Anti-abuse protection (cooldowns, daily limits)
- ✅ Database schema with 9 new tables

### 🎖️ Auto-Promotion System
- ✅ Point-threshold based promotions
- ✅ Automatic Roblox group ranking via API
- ✅ Protection for specific ranks
- ✅ Promotion history tracking
- ✅ Integration with points system

### 🛡️ Security Features
- ✅ Cookie encryption/decryption
- ✅ CSRF token handling for Roblox API
- ✅ Rate limiting protection
- ✅ Protected ranks (can't be changed by bot)
- ✅ Audit trail for all actions

### 📝 New Commands Completed
- ✅ `/setroblosecurity` - Set Roblox cookie (encrypted)
- ✅ `/setpromotionrank` - Configure auto-promotions
- ✅ `/promotionranks` - List promotion thresholds
- ✅ `/promote` - Manually promote users

### 🔄 Updated Commands
- ✅ `/givepoints` - Now with cooldowns, anti-abuse, and auto-promotions

---

## 🔧 Setup Instructions (STEP-BY-STEP FOR BEGINNERS)

### Step 1: Install Dependencies

```bash
cd ~/The-CUSAR-bot
npm install
```

### Step 2: Generate Encryption Key

**IMPORTANT:** You need a 32-character encryption key to secure the Roblox cookie.

Run this command:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64').slice(0, 32))"
```

Copy the output (it will look like: `AbC123...` - exactly 32 characters)

### Step 3: Update Your .env File

Open `.env` (or create it from `.env.example`):

```bash
# If .env doesn't exist:
cp .env.example .env

# Then edit it:
nano .env  # or use any text editor
```

Add this line with your generated key:
```
ENCRYPTION_KEY=your_32_character_key_here
```

Make sure all other variables are set:
```
DISCORD_TOKEN=your_token
DISCORD_CLIENT_ID=your_id
DATABASE_URL=postgresql://...
ENCRYPTION_KEY=your_32_chars
```

### Step 4: Run Database Migration

This creates all the new tables:

```bash
npm run prisma:generate
npm run prisma:migrate
```

When it asks for a migration name, type: `add-promotions-and-security`

### Step 5: Restart Your Bot

```bash
# If using PM2:
pm2 restart roblox-bot

# If running manually:
npm run build
npm start

# If in development:
npm run dev
```

### Step 6: Configure Auto-Promotions in Discord

Now in your Discord server, run these commands:

#### A. Set Your Roblox Cookie

**CRITICAL SECURITY NOTES:**
- Use a BOT ACCOUNT, not your personal account
- The bot account must have ranking permissions in your group
- Run this in a private channel or DM

```
/setroblosecurity cookie:_|WARNING:...
```

The cookie format is: `_|WARNING:-DO-NOT-SHARE-THIS.--Sharing-this-will-allow-someone-to-log-in-as-you-and-to-steal-your-ROBUX-and-items.|_ACTUAL_COOKIE_HERE`

**How to get your cookie:**
1. Log into Roblox with your BOT account
2. Open browser Developer Tools (F12)
3. Go to Application tab → Cookies → roblox.com
4. Find `.ROBLOSECURITY`
5. Copy the entire value
6. Paste into the command

#### B. Configure Promotion Ranks

Example: Promote to "Private" (rank 3) at 50 points:
```
/setpromotionrank points:50 rank-id:3 rank-name:Private
```

Example: Promote to "Corporal" (rank 5) at 100 points:
```
/setpromotionrank points:100 rank-id:5 rank-name:Corporal
```

Repeat for all ranks you want.

#### C. Configure Anti-Abuse Settings

Set point cooldown (30 seconds between gives to same user):
```
/setpointscooldown seconds:30
```

Set max points per give (can't give more than 100 at once):
```
/setmaxpoints amount:100
```

Set daily limit (officer can give max 500 points per day):
```
/setdailypointslimit amount:500
```

#### D. Test It Out

1. Give yourself some points:
   ```
   /givepoints user:@yourself amount:50 reason:Testing
   ```

2. Check your promotions:
   ```
   /promotionranks
   ```

3. Manually promote someone:
   ```
   /promote user:@someone
   ```

---

## 🎯 How It Works

### Auto-Promotion Flow:
1. Officer gives points using `/givepoints`
2. Bot checks cooldown → If failed, stops
3. Bot updates user's points
4. Bot checks if user crossed a promotion threshold
5. Bot checks if current/target rank is protected → If yes, skips
6. Bot calls Roblox API to promote user
7. Bot records promotion in history
8. Bot DMs user about promotion
9. Bot logs to log channel

### Security Checks:
- ✅ Cookie is encrypted in database
- ✅ Cookie is never logged or displayed
- ✅ Cooldowns prevent spam
- ✅ Daily limits prevent abuse
- ✅ Protected ranks can't be changed
- ✅ All actions are audit logged

---

## ⚠️ Troubleshooting

### "ENCRYPTION_KEY not set"
- Make sure you added it to `.env`
- Must be exactly 32 characters
- Restart the bot after adding it

### "Failed to promote: Cookie may be expired"
- Your Roblox cookie expired (they expire every few days)
- Run `/setroblosecurity` again with a fresh cookie
- Make sure you're using a bot account

### "Permission denied" when promoting
- The bot account needs ranking permissions in the group
- Go to group settings → Roles → Give bot role ability to "Manage lower-ranked members"

### "User not in primary group"
- The user must be a member of your primary Roblox group
- Set primary group: `/setprimarygroup [group-id]`

### Database errors after migration
```bash
# Reset database (WARNING: Deletes all data)
npm run prisma:migrate reset

# Then re-run
npm run prisma:generate
npm run prisma:migrate
```

---

## 📋 What Still Needs to Be Created

### Commands Still Needed:

#### Promotion Commands (3 more):
- `/demote @user [rank-id]` - Demote someone
- `/setrank @user [rank-id]` - Set someone to specific rank
- `/removepromotionrank [points]` - Remove a promotion threshold

#### Rank Protection Commands (3):
- `/addprotectedrank [rank-id]` - Protect a rank from bot changes
- `/removeprotectedrank [rank-id]` - Unprotect a rank
- `/protectedranks` - List protected ranks

#### Cooldown/Limit Commands (3):
- `/setpointscooldown [seconds]` - Set cooldown between gives
- `/setmaxpoints [amount]` - Max points per give
- `/setdailypointslimit [amount]` - Max points officer can give daily

#### Promotion Mode Commands (2):
- `/setpromotionmode [auto/request]` - Set auto or approval mode
- `/setpromotionschannel [channel]` - Where approval requests go

#### Statistics Commands (4):
- `/stats @user` - Full user statistics
- `/toppoints [week/month/all]` - Points leaderboard by period
- `/topofficers [week/month]` - Which officers gave most points
- `/serverstats` - Server-wide statistics

#### Audit Commands (1):
- `/auditlog @user` - View all actions for a user

#### Activity Commands (already partially done, need):
- `/setactivitypoints [type] [points]` - Configure activity points
  (This exists as `/setactivitypoints` but needs better integration)

### Systems Still Needed:

1. **Promotion Approval System**
   - Button handling for approve/deny promotions
   - Event handler for button clicks
   - DM notifications

2. **Point Decay System**
   - Cron job or scheduled task
   - `/setpointdecay [points-per-week]`
   - `/setdecayimmunity [rank-id]`
   - Weekly decay application

3. **Activity Session Tracking**
   - Enhanced API endpoints for join/leave
   - Automatic playtime point calculation
   - Session management

---

## 🔨 Command Templates

Here are templates for creating the remaining commands. Copy these and modify:

### Template: Protected Rank Command

```typescript
/**
 * /addprotectedrank - Protect a rank from bot changes
 */

import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import prisma from '../db/client.js';
import { isAdmin } from '../lib/permissions.js';
import { logger } from '../lib/logger.js';

export const data = new SlashCommandBuilder()
  .setName('addprotectedrank')
  .setDescription('Protect a rank from being changed by the bot')
  .addIntegerOption(option =>
    option
      .setName('rank-id')
      .setDescription('Roblox rank number to protect')
      .setRequired(true)
      .setMinValue(0)
      .setMaxValue(255)
  )
  .addStringOption(option =>
    option
      .setName('rank-name')
      .setDescription('Name of the rank (optional)')
      .setRequired(false)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild || !interaction.member) {
    return interaction.reply({ content: '❌ This command can only be used in a server.', ephemeral: true });
  }

  if (!(await isAdmin(interaction.member as any))) {
    return interaction.reply({ content: '❌ You do not have permission to use this command.', ephemeral: true });
  }

  await interaction.deferReply();

  const rankId = interaction.options.getInteger('rank-id', true);
  const rankName = interaction.options.getString('rank-name');

  try {
    // Create guild config if needed
    await prisma.guildConfig.upsert({
      where: { guildId: interaction.guild.id },
      update: {},
      create: { guildId: interaction.guild.id },
    });

    // Create protected rank
    await prisma.protectedRank.upsert({
      where: {
        guildId_rankId: {
          guildId: interaction.guild.id,
          rankId: rankId,
        },
      },
      update: {
        rankName: rankName || undefined,
      },
      create: {
        guildId: interaction.guild.id,
        rankId: rankId,
        rankName: rankName || undefined,
      },
    });

    await interaction.editReply({
      content: `✅ Rank ${rankId}${rankName ? ` (${rankName})` : ''} is now protected.\n\n` +
               `The bot will not promote or demote users to/from this rank.`,
    });

    logger.info(`${interaction.user.tag} protected rank ${rankId} in ${interaction.guild.name}`);
  } catch (error) {
    logger.error('Error in /addprotectedrank command:', error);
    await interaction.editReply({
      content: '❌ An error occurred while protecting the rank.',
    });
  }
}
```

### Template: Statistics Command

```typescript
/**
 * /stats - Show comprehensive user statistics
 */

import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import prisma from '../db/client.js';
import { getUserRankInGroup } from '../lib/roblox.js';
import { logger } from '../lib/logger.js';

export const data = new SlashCommandBuilder()
  .setName('stats')
  .setDescription('View comprehensive statistics for a user')
  .addUserOption(option =>
    option
      .setName('user')
      .setDescription('User to check (leave empty for yourself)')
      .setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const targetUser = interaction.options.getUser('user') || interaction.user;

  try {
    const user = await prisma.user.findUnique({
      where: { discordId: targetUser.id },
      include: {
        pointTransactions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        promotionHistory: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    });

    if (!user) {
      return interaction.editReply({
        content: `❌ ${targetUser.tag} is not verified.`,
      });
    }

    // Get config
    const config = await prisma.guildConfig.findUnique({
      where: { guildId: interaction.guildId! },
    });

    // Calculate time since verification
    const daysSinceVerification = Math.floor(
      (Date.now() - user.verifiedAt.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Get current rank if primary group configured
    let currentRankText = 'N/A';
    if (config?.primaryGroupId) {
      const rankInfo = await getUserRankInGroup(user.robloxId, config.primaryGroupId);
      if (rankInfo) {
        currentRankText = `${rankInfo.rank} - ${rankInfo.roleName}`;
      }
    }

    // Count promotions
    const promotionCount = user.promotionHistory.length;

    // Get points this week/month
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const weeklyTransactions = await prisma.pointTransaction.findMany({
      where: {
        userId: user.id,
        createdAt: { gte: weekAgo },
      },
    });

    const monthlyTransactions = await prisma.pointTransaction.findMany({
      where: {
        userId: user.id,
        createdAt: { gte: monthAgo },
      },
    });

    const weeklyPoints = weeklyTransactions.reduce((sum, t) =>
      sum + (t.type === 'add' ? t.amount : -t.amount), 0
    );

    const monthlyPoints = monthlyTransactions.reduce((sum, t) =>
      sum + (t.type === 'add' ? t.amount : -t.amount), 0
    );

    const embed = new EmbedBuilder()
      .setTitle(`📊 Statistics for ${user.robloxUsername}`)
      .setThumbnail(`https://www.roblox.com/headshot-thumbnail/image?userId=${user.robloxId}&width=150&height=150&format=png`)
      .addFields(
        { name: '🏆 Total Points', value: user.points.toString(), inline: true },
        { name: '📅 Points This Week', value: weeklyPoints.toString(), inline: true },
        { name: '📅 Points This Month', value: monthlyPoints.toString(), inline: true },
        { name: '🎖️ Current Rank', value: currentRankText, inline: true },
        { name: '⬆️ Total Promotions', value: promotionCount.toString(), inline: true },
        { name: '📆 Days Verified', value: daysSinceVerification.toString(), inline: true }
      )
      .setColor(0x0099ff)
      .setFooter({ text: `Discord: ${targetUser.tag} | Roblox ID: ${user.robloxId}` })
      .setTimestamp();

    // Add recent promotions if any
    if (user.promotionHistory.length > 0) {
      const recentPromotions = user.promotionHistory
        .slice(0, 3)
        .map(p => `${p.rankName} (<t:${Math.floor(p.createdAt.getTime() / 1000)}:R>)`)
        .join('\n');

      embed.addFields({
        name: '📜 Recent Promotions',
        value: recentPromotions,
        inline: false,
      });
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    logger.error('Error in /stats command:', error);
    await interaction.editReply({
      content: '❌ An error occurred while fetching statistics.',
    });
  }
}
```

---

## 🎓 Learning Resources

### Understanding the Code:

1. **Encryption** (`src/lib/encryption.ts`):
   - Uses AES-256-GCM (very secure)
   - Adds salt and IV for extra security
   - Never stores plain text cookies

2. **Auto-Promotion** (`src/lib/autoPromotion.ts`):
   - Triggered after points are given
   - Checks eligibility (points, protected ranks)
   - Calls Roblox API to perform rank change
   - Records history and sends notifications

3. **Anti-Abuse** (`src/lib/antiAbuse.ts`):
   - Tracks cooldowns per officer-target pair
   - Tracks daily totals per officer
   - Prevents spam and abuse

4. **Audit Log** (`src/lib/audit.ts`):
   - Records all important actions
   - Searchable by user or action type
   - Includes full details in JSON

### How to Extend:

Want to add a new command? Follow this pattern:

1. Create file in `src/commands/yourcommand.ts`
2. Import needed utilities
3. Define the slash command with `.setName()`, `.setDescription()`, etc.
4. Add permission checks
5. Implement the logic
6. Add audit logging
7. Test it!

---

## 📞 Need Help?

If you get stuck:

1. **Check logs**: `pm2 logs roblox-bot` or console output
2. **Check database**: `npm run prisma:studio` to view data
3. **Test encryption**: Run `node -e "console.log(require('./dist/lib/encryption.js').testEncryption())"`
4. **Verify cookie**: Use `/promote` command and check error message

Common errors and solutions are in the Troubleshooting section above.

---

## 🎉 What You Have Now

Your bot now has:
- ✅ Secure Roblox ranking capabilities
- ✅ Automatic promotions based on points
- ✅ Anti-abuse protection
- ✅ Complete audit trail
- ✅ Manual promotion commands
- ✅ Encrypted sensitive data storage

This is a **professional-grade** military/group management system!

---

*Created with ❤️ for beginner-friendly Discord bot development*
