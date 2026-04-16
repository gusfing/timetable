/**
 * Setup script for Telegram bot
 * Run this after deploying to production to configure the webhook
 */

import * as dotenv from 'dotenv';
import { Bot } from 'grammy';

dotenv.config({ path: '.env.local' });

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WEBHOOK_URL = process.env.NEXT_PUBLIC_VERCEL_URL 
    ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}/api/telegram-webhook`
    : process.env.WEBHOOK_URL;
const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;

async function setupWebhook() {
    if (!BOT_TOKEN) {
        console.error('❌ TELEGRAM_BOT_TOKEN is not set in environment variables');
        process.exit(1);
    }

    if (!WEBHOOK_URL) {
        console.error('❌ WEBHOOK_URL or NEXT_PUBLIC_VERCEL_URL is not set');
        console.log('💡 Set WEBHOOK_URL to your production URL, e.g., https://your-domain.vercel.app/api/telegram-webhook');
        process.exit(1);
    }

    const bot = new Bot(BOT_TOKEN);

    try {
        console.log('🔧 Setting up Telegram webhook...');
        console.log(`📍 Webhook URL: ${WEBHOOK_URL}`);

        // Set webhook
        const result = await bot.api.setWebhook(WEBHOOK_URL, {
            secret_token: WEBHOOK_SECRET,
            drop_pending_updates: true,
            allowed_updates: ['message', 'callback_query']
        });

        if (result) {
            console.log('✅ Webhook set up successfully!');
            
            // Get webhook info to verify
            const info = await bot.api.getWebhookInfo();
            console.log('\n📊 Webhook Info:');
            console.log(`   URL: ${info.url}`);
            console.log(`   Pending updates: ${info.pending_update_count}`);
            console.log(`   Last error: ${info.last_error_message || 'None'}`);
            console.log(`   Max connections: ${info.max_connections}`);
        } else {
            console.error('❌ Failed to set up webhook');
            process.exit(1);
        }

    } catch (error) {
        console.error('❌ Error setting up webhook:', error);
        process.exit(1);
    }
}

async function removeWebhook() {
    if (!BOT_TOKEN) {
        console.error('❌ TELEGRAM_BOT_TOKEN is not set');
        process.exit(1);
    }

    const bot = new Bot(BOT_TOKEN);

    try {
        console.log('🔧 Removing webhook...');
        const result = await bot.api.deleteWebhook({ drop_pending_updates: true });
        
        if (result) {
            console.log('✅ Webhook removed successfully!');
            console.log('💡 Bot is now ready for polling mode (development)');
        } else {
            console.error('❌ Failed to remove webhook');
            process.exit(1);
        }

    } catch (error) {
        console.error('❌ Error removing webhook:', error);
        process.exit(1);
    }
}

async function getWebhookInfo() {
    if (!BOT_TOKEN) {
        console.error('❌ TELEGRAM_BOT_TOKEN is not set');
        process.exit(1);
    }

    const bot = new Bot(BOT_TOKEN);

    try {
        const info = await bot.api.getWebhookInfo();
        console.log('📊 Webhook Info:');
        console.log(`   URL: ${info.url || 'Not set (polling mode)'}`);
        console.log(`   Pending updates: ${info.pending_update_count}`);
        console.log(`   Last error: ${info.last_error_message || 'None'}`);
        console.log(`   Last error date: ${info.last_error_date ? new Date(info.last_error_date * 1000).toISOString() : 'N/A'}`);
        console.log(`   Max connections: ${info.max_connections}`);
        console.log(`   Allowed updates: ${info.allowed_updates?.join(', ') || 'All'}`);

    } catch (error) {
        console.error('❌ Error getting webhook info:', error);
        process.exit(1);
    }
}

async function getBotInfo() {
    if (!BOT_TOKEN) {
        console.error('❌ TELEGRAM_BOT_TOKEN is not set');
        process.exit(1);
    }

    const bot = new Bot(BOT_TOKEN);

    try {
        const me = await bot.api.getMe();
        console.log('🤖 Bot Info:');
        console.log(`   Username: @${me.username}`);
        console.log(`   Name: ${me.first_name}`);
        console.log(`   ID: ${me.id}`);
        console.log(`   Can join groups: ${me.can_join_groups}`);
        console.log(`   Can read all group messages: ${me.can_read_all_group_messages}`);
        console.log(`   Supports inline queries: ${me.supports_inline_queries}`);

    } catch (error) {
        console.error('❌ Error getting bot info:', error);
        process.exit(1);
    }
}

// Parse command line arguments
const command = process.argv[2];

switch (command) {
    case 'setup':
        setupWebhook();
        break;
    case 'remove':
        removeWebhook();
        break;
    case 'info':
        getWebhookInfo();
        break;
    case 'bot':
        getBotInfo();
        break;
    default:
        console.log('📖 Telegram Bot Setup Script\n');
        console.log('Usage:');
        console.log('  npm run bot:setup    - Set up webhook for production');
        console.log('  npm run bot:remove   - Remove webhook (for development)');
        console.log('  npm run bot:info     - Get webhook information');
        console.log('  npm run bot:bot      - Get bot information');
        console.log('\nExamples:');
        console.log('  npm run bot:setup');
        console.log('  WEBHOOK_URL=https://your-domain.vercel.app/api/telegram-webhook npm run bot:setup');
        process.exit(0);
}
