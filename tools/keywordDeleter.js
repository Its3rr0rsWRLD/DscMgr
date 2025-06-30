import inquirer from 'inquirer';
import axios from 'axios';
import chalk from 'chalk';
import fs from 'fs';

export const name = 'Keyword Deleter';
export const description = 'Find and delete your Discord messages by keyword.';

function logAll(config, data) {
    if (config && config.debug) {
        const logLine = `[${new Date().toISOString()}] ${typeof data === 'string' ? data : JSON.stringify(data, null, 2)}\n`;
        fs.appendFileSync('logs.txt', logLine);
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchUserId(token, config) {
    while (true) {
        try {
            const response = await axios.get('https://discord.com/api/v9/users/@me', {
                headers: getDiscordHeaders(token),
            });
            logAll(config, { action: 'fetchUserId', response: response.data });
            return response.data.id;
        } catch (err) {
            if (err.response && err.response.status === 429) {
                const retry = (err.response.data.retry_after || 1) * 1000;
                logAll(config, { action: 'fetchUserId', rateLimited: true, retry });
                await sleep(retry);
                continue;
            }
            logAll(config, { action: 'fetchUserId', error: err.toString() });
            throw err;
        }
    }
}

async function fetchGuildIds(token, config) {    while (true) {
        try {
            const response = await axios.get('https://discord.com/api/v9/users/@me/guilds', {
                headers: getDiscordHeaders(token),
                timeout: 10000
            });
            logAll(config, { action: 'fetchGuildIds', response: response.data });
            return response.data.map(guild => guild.id);
        } catch (err) {
            if (err.response && err.response.status === 429) {
                const retry = (err.response.data.retry_after || 1) * 1000;
                logAll(config, { action: 'fetchGuildIds', rateLimited: true, retry });
                await sleep(retry);
                continue;
            }
            logAll(config, { action: 'fetchGuildIds', error: err.toString() });
            throw err;
        }
    }
}

async function fetchGuildChannels(token, guildId, config) {    while (true) {
        try {
            const response = await axios.get(`https://discord.com/api/v9/guilds/${guildId}/channels`, {
                headers: getDiscordHeaders(token),
                timeout: 10000
            });
            logAll(config, { action: 'fetchGuildChannels', guildId, response: response.data });
            return response.data.filter(c => c.type === 0);
        } catch (err) {
            if (err.response && err.response.status === 429) {
                const retry = (err.response.data.retry_after || 1) * 1000;
                logAll(config, { action: 'fetchGuildChannels', guildId, rateLimited: true, retry });
                await sleep(retry);
                continue;
            }
            logAll(config, { action: 'fetchGuildChannels', guildId, error: err.toString() });
            throw err;
        }
    }
}

async function fetchDMChannelIds(token, config) {    while (true) {
        try {
            const response = await axios.get('https://discord.com/api/v9/users/@me/channels', {
                headers: getDiscordHeaders(token),
                timeout: 10000
            });
            logAll(config, { action: 'fetchDMChannelIds', response: response.data });
            return response.data.filter(channel => channel.type === 1).map(channel => channel.id);
        } catch (err) {
            if (err.response && err.response.status === 429) {
                const retry = (err.response.data.retry_after || 1) * 1000;
                logAll(config, { action: 'fetchDMChannelIds', rateLimited: true, retry });
                await sleep(retry);
                continue;
            }
            logAll(config, { action: 'fetchDMChannelIds', error: err.toString() });
            throw err;
        }
    }
}

async function searchMessages(token, channelOrGuildId, authorId, keyword, isGuild, config, fastMode = false) {
    let urlBase;
    if (isGuild) {
        urlBase = `https://discord.com/api/v9/guilds/${channelOrGuildId}/messages/search?author_id=${authorId}`;
    } else {
        urlBase = `https://discord.com/api/v9/channels/${channelOrGuildId}/messages/search?author_id=${authorId}`;
    }
    
    if (fastMode && keyword) {
        urlBase += `&content=${encodeURIComponent(keyword)}`;
    }
    
    let offset = 0;
    let allMessages = [];
    let totalResults = 0;
      while (true) {
        try {
            const url = urlBase + `&offset=${offset}`;
            const response = await axios.get(url, {
                headers: getDiscordHeaders(token),
                timeout: 10000
            });
            
            logAll(config, { action: 'searchMessages', url, response: response.data });
            const messages = response.data.messages?.flat() || [];
            if (messages.length === 0) break;
            
            allMessages.push(...messages);
            totalResults += messages.length;
            offset += messages.length;
            
            if (!response.data.total_results || offset >= response.data.total_results) break;
        } catch (err) {
            if (err.response && err.response.status === 429) {
                const retry = (err.response.data.retry_after || 1) * 1000;
                console.log(chalk.redBright(`Rate limited! Waiting ${err.response.data.retry_after || 1} seconds...`));
                logAll(config, { action: 'searchMessages', rateLimited: true, retry });
                await sleep(retry);
                continue;
            }
            console.log(chalk.red(`Search failed: ${err.message}`));
            logAll(config, { action: 'searchMessages', error: err.toString() });
            break;
        }
    }
    
    if (!fastMode && keyword) {
        const keywordLower = keyword.toLowerCase();
        allMessages = allMessages.filter(msg => 
            msg.content && msg.content.toLowerCase().includes(keywordLower)
        );
    }
    
    return allMessages;
}

async function deleteMessage(token, channelId, messageId, config) {
    let retryCount = 0;
    const maxRetries = 5;
    
    while (retryCount < maxRetries) {
        try {
            const url = `https://discord.com/api/v9/channels/${channelId}/messages/${messageId}`;
            const headers = getDiscordHeaders(token);
            const requestConfig = {
                headers,
                timeout: 10000
            };
            
            const response = await axios.delete(url, requestConfig);
            logAll(config, { action: 'deleteMessage', url, response: response.data });
            return response.data;
        } catch (err) {
            const headers = getDiscordHeaders(token);
            const requestDetails = {
                action: 'deleteMessage',
                channelId,
                messageId,
                url: `https://discord.com/api/v9/channels/${channelId}/messages/${messageId}`,
                method: 'DELETE',
                headers: headers,
                error: err.toString(),
                responseStatus: err.response?.status,
                responseData: err.response?.data,
                retryCount: retryCount
            };
            
            if (err.response && err.response.status === 429) {
                const retryAfter = err.response.data.retry_after || 1;
                const retryMs = retryAfter * 1000;
                requestDetails.rateLimited = true;
                requestDetails.retry = retryMs;
                
                console.log(chalk.yellow(`⏳ Rate limited! Waiting ${retryAfter} seconds before retry (attempt ${retryCount + 1}/${maxRetries})...`));
                logAll(config, requestDetails);
                
                await sleep(retryMs);
                retryCount++;
                continue;
            }
            if (err.response && err.response.status === 404) {
                console.log(chalk.yellow(`⚠️  Message ${messageId} was already deleted`));
                logAll(config, requestDetails);
                return null;
            }
            if (err.response && err.response.status === 403) {
                console.log(chalk.yellow(`⚠️  No permission to delete message ${messageId}`));
                logAll(config, requestDetails);
                return null;
            }
            
            if (retryCount < maxRetries - 1) {
                console.log(chalk.yellow(`⚠️  Error deleting message ${messageId}: ${err.response?.status || err.message}. Retrying in 2 seconds... (${retryCount + 1}/${maxRetries})`));
                retryCount++;
                await sleep(2000);
                continue;
            }
            
            logAll(config, requestDetails);
            throw err;
        }
    }
    
    console.log(chalk.red(`❌ Failed to delete message ${messageId} after ${maxRetries} attempts`));
    return null;
}

async function checkMessageExists(token, channelId, messageId, config) {
    try {
        const url = `https://discord.com/api/v9/channels/${channelId}/messages/${messageId}`;
        const response = await axios.get(url, {
            headers: getDiscordHeaders(token),
            timeout: 10000
        });
        logAll(config, { action: 'checkMessageExists', messageId, exists: true });
        return response.data;
    } catch (err) {
        if (err.response && err.response.status === 404) {
            logAll(config, { action: 'checkMessageExists', messageId, exists: false, reason: 'Message not found (404)' });
            return null;
        }
        if (err.response && err.response.status === 403) {
            logAll(config, { action: 'checkMessageExists', messageId, exists: false, reason: 'No permission to view message (403)' });
            return null;
        }
        logAll(config, { action: 'checkMessageExists', messageId, error: err.toString() });
        throw err;
    }
}

async function editMessage(token, channelId, messageId, newContent, config) {
    let retryCount = 0;
    const maxRetries = 5;
    
    while (retryCount < maxRetries) {
        try {
            const url = `https://discord.com/api/v9/channels/${channelId}/messages/${messageId}`;
            const response = await axios.patch(url, {
                content: newContent
            }, {
                headers: getDiscordHeaders(token),
                timeout: 10000
            });
            logAll(config, { action: 'editMessage', url, response: response.data });
            return response.data;
        } catch (err) {
            if (err.response && err.response.status === 429) {
                const retryAfter = err.response.data.retry_after || 1;
                const retryMs = retryAfter * 1000;
                
                console.log(chalk.yellow(`⏳ Rate limited! Waiting ${retryAfter} seconds before retry (attempt ${retryCount + 1}/${maxRetries})...`));
                logAll(config, { action: 'editMessage', channelId, messageId, rateLimited: true, retry: retryMs, retryCount });
                
                await sleep(retryMs);
                retryCount++;
                continue;
            }
            if (err.response && err.response.status === 404) {
                console.log(chalk.yellow(`⚠️  Message ${messageId} was deleted while trying to edit it`));
                logAll(config, { action: 'editMessage', channelId, messageId, error: 'Message deleted during edit (404)' });
                return null;
            }
            if (err.response && err.response.status === 403) {
                console.log(chalk.yellow(`⚠️  No permission to edit message ${messageId}`));
                logAll(config, { action: 'editMessage', channelId, messageId, error: 'No permission to edit (403)' });
                return null;
            }
            if (err.response && err.response.status === 400) {
                console.log(chalk.yellow(`⚠️  Invalid edit request for message ${messageId}: ${err.response.data.message || 'Bad request'}`));
                logAll(config, { action: 'editMessage', channelId, messageId, error: `Bad request (400): ${err.response.data.message}` });
                return null;
            }
            
            if (retryCount < maxRetries - 1) {
                console.log(chalk.yellow(`⚠️  Error editing message ${messageId}: ${err.response?.status || err.message}. Retrying in 2 seconds... (${retryCount + 1}/${maxRetries})`));
                retryCount++;
                await sleep(2000);
                continue;
            }
            
            logAll(config, { action: 'editMessage', channelId, messageId, error: err.toString(), retryCount });
            throw err;
        }
    }
    
    console.log(chalk.red(`❌ Failed to edit message ${messageId} after ${maxRetries} attempts`));
    return null;
}

function getDiscordHeaders(token) {
    return {
        'authorization': token,
        'accept': '*/*',
        'accept-language': 'en-US',
        'priority': 'u=1, i',
        'sec-ch-ua': '"Not:A-Brand";v="24", "Chromium";v="134"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin',
        'x-debug-options': 'bugReporterEnabled',
        'x-discord-locale': 'en-US',
        'x-discord-timezone': 'America/Chicago',
        'x-super-properties': 'eyJvcyI6IldpbmRvd3MiLCJicm93c2VyIjoiRGlzY29yZCBDbGllbnQiLCJyZWxlYXNlX2NoYW5uZWwiOiJzdGFibGUiLCJjbGllbnRfdmVyc2lvbiI6IjEuMC45MTk1Iiwib3NfdmVyc2lvbiI6IjEwLjAuMjI2MjEiLCJvc19hcmNoIjoieDY0IiwiYXBwX2FyY2giOiJ4NjQiLCJzeXN0ZW1fbG9jYWxlIjoiZW4tVVMiLCJoYXNfY2xpZW50X21vZHMiOmZhbHNlLCJjbGllbnRfbGF1bmNoX2lkIjoiYTExMjkwN2EtZjVhYi00NDE0LWIxOWMtYzk1ZWViY2I2ZmU5IiwiYnJvd3Nlcl91c2VyX2FnZW50IjoiTW96aWxsYS81LjAgKFdpbmRvd3MgTlQgMTAuMDsgV2luNjQ7IHg2NCkgQXBwbGVXZWJLaXQvNTM3LjM2IChLSFRNTCwgbGlrZSBHZWNrbykgZGlzY29yZC8xLjAuOTE5NSBDaHJvbWUvMTM0LjAuNjk5OC4yMDUgRWxlY3Ryb24vMzUuMy4wIFNhZmFyaS81MzcuMzYiLCJicm93c2VyX3ZlcnNpb24iOiIzNS4zLjAiLCJvc19zZGtfdmVyc2lvbiI6IjIyNjIxIiwiY2xpZW50X2J1aWxkX251bWJlciI6NDA5MjE0LCJuYXRpdmVfYnVpbGRfbnVtYmVyIjo2NDYzOCwiY2xpZW50X2V2ZW50X3NvdXJjZSI6bnVsbCwiY2xpZW50X2hlYXJ0YmVhdF9zZXNzaW9uX2lkIjoiZGExMThmYmUtMzBhNC00ZjgzLTgxYmUtNWI3YTg0ZTRjNTQ1IiwiY2xpZW50X2FwcF9zdGF0ZSI6ImZvY3VzZWQifQ=='
    };
}

const pastelRed = (typeof global !== 'undefined' && global.pastelRed) || (chalk.hex ? chalk.hex('#ff5555').bold : chalk.red.bold);

const originalPrompt = inquirer.prompt;
inquirer.prompt = async function(questions, ...args) {
    if (Array.isArray(questions)) {
        questions = questions.map(q => ({
            ...q,
            message: q.message ? pastelRed(q.message) : q.message,
            prefix: pastelRed('✔')
        }))
    } else if (questions && typeof questions === 'object') {
        questions.message = questions.message ? pastelRed(questions.message) : questions.message;
        questions.prefix = pastelRed('✔');
    }
    return originalPrompt.call(this, questions, ...args);
}

export async function run(config) {
    const token = config.token;
    if (!token) {
        console.log(chalk.red('No Discord token found in config.'));
        return;
    }
    
    const authorId = await fetchUserId(token, config);
    const { keyword, guildIdsRaw, mode } = await inquirer.prompt([
        { type: 'input', name: 'keyword', message: 'Keyword to search (leave blank for all):' },
        { type: 'input', name: 'guildIdsRaw', message: 'Guild IDs to search (comma separated, blank for all):' },
        { type: 'list', name: 'mode', message: 'Search mode:', choices: ['search API (fast, may miss some)', 'all user messages (slower, more accurate)'] }
    ]);
    const fastMode = mode.startsWith('search API');
    const guildIds = guildIdsRaw.split(',').map(x => x.trim()).filter(Boolean);
    let searchDMs = false;
    let dmIds = [];
    if (guildIds.length === 0) {
        searchDMs = true;
        dmIds = await fetchDMChannelIds(token, config);
    } else {
        const allDMIds = await fetchDMChannelIds(token, config);
        dmIds = guildIds.filter(id => allDMIds.includes(id));
        searchDMs = dmIds.length > 0;
    }    let allChannels = [];
    if (guildIds.length > 0) {
        for (const gid of guildIds.filter(id => !dmIds.includes(id))) {
            allChannels.push({ id: gid, guildId: gid, isGuild: true, fastMode });
        }
    } else {
        const allGuilds = await fetchGuildIds(token, config);
        for (const gid of allGuilds) {
            allChannels.push({ id: gid, guildId: gid, isGuild: true, fastMode });
        }
    }    if (searchDMs && dmIds.length > 0) {
        allChannels.push(...dmIds.map(id => ({ id, isDM: true, fastMode: false })));
    }    let foundMessages = [];
    for (const channel of allChannels) {
        const isGuild = channel.isGuild && !channel.isDM;
        const channelId = channel.id;
        
        const messages = await searchMessages(token, channelId, authorId, keyword, isGuild, config, channel.fastMode);
        foundMessages.push(...messages.map(m => ({ ...m, channelId, guildId: channel.guildId })));
        console.log(chalk.green(`Found ${messages.length} messages in ${isGuild ? `guild ${channel.guildId}` : `DM channel ${channelId}`}`));
          if (messages.length > 0) {
            console.log(chalk.cyan('Messages found:'));
            messages.forEach((msg, index) => {
                const preview = msg.content ? msg.content.substring(0, 100) : '[No content]';
                const timestamp = new Date(msg.timestamp).toLocaleString();
                console.log(chalk.gray(`  ${index + 1}. [${timestamp}] ${preview}${msg.content && msg.content.length > 100 ? '...' : ''}`));
            });
            console.log('');
        }}
    console.log(chalk.yellow(`Total messages found: ${foundMessages.length}`));
    
    if (foundMessages.length === 0) {
        console.log(chalk.blue('No messages found.'));
        return;
    }
    
    const { action } = await inquirer.prompt([
        { 
            type: 'list', 
            name: 'action', 
            message: `What would you like to do with ${foundMessages.length} found messages?`, 
            choices: [
                { name: 'Delete all messages', value: 'delete' },
                { name: 'Edit messages to remove keyword', value: 'edit' },
                { name: 'Cancel', value: 'cancel' }
            ]
        }
    ]);
    
    if (action === 'cancel') return;
    
    if (action === 'delete') {
        const { confirm } = await inquirer.prompt([
            { type: 'confirm', name: 'confirm', message: `Delete all ${foundMessages.length} messages?`, default: true }
        ]);
        if (!confirm) return;        console.log(chalk.blue(`🗑️  Starting to delete ${foundMessages.length} messages...`));
        
        for (let i = 0; i < foundMessages.length; i++) {
            const msg = foundMessages[i];
            const progress = `(${i + 1}/${foundMessages.length})`;
            
            try {
                console.log(chalk.gray(`${progress} Deleting message ${msg.id}...`));
                const result = await deleteMessage(token, msg.channel_id, msg.id, config);
                if (result !== null) {
                    console.log(chalk.green(`✅ ${progress} Deleted message ${msg.id} in channel ${msg.channel_id}`));
                } else {
                    console.log(chalk.yellow(`⚠️  ${progress} Skipped message ${msg.id} in channel ${msg.channel_id} (could not delete)`));
                }
                
                if (i < foundMessages.length - 1) {
                    await sleep(500);
                }
            } catch (err) {
                console.log(chalk.red(`❌ ${progress} Failed to delete message ${msg.id}: ${err.message}`));
                if (i < foundMessages.length - 1) {
                    await sleep(1000);
                }
            }
        }
    } else if (action === 'edit') {
        const { confirm } = await inquirer.prompt([
            { type: 'confirm', name: 'confirm', message: `Edit ${foundMessages.length} messages to remove "${keyword}"?`, default: true }
        ]);
        if (!confirm) return;        console.log(chalk.blue(`✏️  Starting to edit ${foundMessages.length} messages...`));
        
        for (let i = 0; i < foundMessages.length; i++) {
            const msg = foundMessages[i];
            const progress = `(${i + 1}/${foundMessages.length})`;
            
            try {
                const originalContent = msg.content || '';
                const keywordRegex = new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
                const newContent = originalContent.replace(keywordRegex, '').trim();
                
                if (newContent === '') {
                    console.log(chalk.gray(`${progress} Message ${msg.id} would be empty, deleting instead...`));
                    const result = await deleteMessage(token, msg.channel_id, msg.id, config);
                    if (result !== null) {
                        console.log(chalk.yellow(`🗑️  ${progress} Deleted empty message ${msg.id} in channel ${msg.channel_id}`));
                    } else {
                        console.log(chalk.yellow(`⚠️  ${progress} Skipped empty message ${msg.id} in channel ${msg.channel_id} (could not delete)`));
                    }
                } else {
                    console.log(chalk.gray(`${progress} Editing message ${msg.id}...`));
                    const result = await editMessage(token, msg.channel_id, msg.id, newContent, config);
                    if (result) {
                        console.log(chalk.green(`✏️  ${progress} Edited message ${msg.id} in channel ${msg.channel_id}`));
                    } else {
                        console.log(chalk.yellow(`⚠️  ${progress} Skipped message ${msg.id} in channel ${msg.channel_id} (could not edit)`));
                    }
                }
                
                if (i < foundMessages.length - 1) {
                    await sleep(500);
                }
            } catch (err) {
                console.log(chalk.red(`❌ ${progress} Failed to process message ${msg.id}: ${err.message}`));
                if (i < foundMessages.length - 1) {
                    await sleep(1000);
                }
            }
        }
    }
    
    try {
        await inquirer.prompt({ type: 'input', name: 'pause', message: 'Press Enter to return to menu...' })
    } catch (error) {
        console.log(chalk.red('An error occurred: ' + error.message));
        await inquirer.prompt({ type: 'input', name: 'pause', message: 'Press Enter to return to menu...' })
    }
}
