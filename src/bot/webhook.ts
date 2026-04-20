import { webhookCallback } from 'grammy';
import { getBot } from './index';

/**
 * Webhook handler for Telegram bot
 * This can be used with Next.js API routes or serverless functions
 */
export const handleWebhook = webhookCallback(getBot(), 'std/http');

/**
 * Setup webhook for the bot
 * Call this once to configure the webhook URL
 */
export async function setupWebhook(webhookUrl: string) {
    try {
        const result = await getBot().api.setWebhook(webhookUrl);
        console.log('Webhook setup result:', result);
        return { success: true, result };
    } catch (error) {
        console.error('Error setting up webhook:', error);
        return { success: false, error };
    }
}

/**
 * Remove webhook (useful for development with polling)
 */
export async function removeWebhook() {
    try {
        const result = await getBot().api.deleteWebhook();
        console.log('Webhook removed:', result);
        return { success: true, result };
    } catch (error) {
        console.error('Error removing webhook:', error);
        return { success: false, error };
    }
}

/**
 * Get webhook info
 */
export async function getWebhookInfo() {
    try {
        const info = await getBot().api.getWebhookInfo();
        console.log('Webhook info:', info);
        return { success: true, info };
    } catch (error) {
        console.error('Error getting webhook info:', error);
        return { success: false, error };
    }
}

export default {
    handleWebhook,
    setupWebhook,
    removeWebhook,
    getWebhookInfo
};
