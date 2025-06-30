import inquirer from 'inquirer'
import axios from 'axios'
import chalk from 'chalk'
import fs from 'fs'
import path from 'path'

export const name = 'Scrape User Messages'
export const description = 'Scrape all messages from a user in mutual servers.'

function logAll(config, data) {
    if (config && config.debug) {
        const logLine = `[${new Date().toISOString()}] ${typeof data === 'string' ? data : JSON.stringify(data, null, 2)}\n`
        fs.appendFileSync('logs.txt', logLine)
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

function getDiscordHeaders(token) {
    return {
        'authorization': token,
        'accept': '*/*',
        'accept-language': 'en-US',
        'sec-ch-ua': '"Not:A-Brand";v="24", "Chromium";v="134"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin',
        'x-debug-options': 'bugReporterEnabled',
        'x-discord-locale': 'en-US',
        'x-discord-timezone': 'America/Chicago',
        'x-super-properties': 'eyJvcyI6IldpbmRvd3MiLCJicm93c2VyIjoiRGlzY29yZCBDbGllbnQiLCJyZWxlYXNlX2NoYW5uZWwiOiJzdGFibGUiLCJjbGllbnRfdmVyc2lvbiI6IjEuMC45MTk1Iiwib3NfdmVyc2lvbiI6IjEwLjAuMjI2MjEiLCJvc19hcmNoIjoieDY0IiwiYXBwX2FyY2giOiJ4NjQiLCJzeXN0ZW1fbG9jYWxlIjoiZW4tVVMiLCJoYXNfY2xpZW50X21vZHMiOmZhbHNlLCJjbGllbnRfbGF1bmNoX2lkIjoiYTExMjkwN2EtZjVhYi00NDE0LWIxOWMtYzk1ZWViY2I2ZmU5IiwiYnJvd3Nlcl91c2VyX2FnZW50IjoiTW96aWxsYS81LjAgKFdpbmRvd3MgTlQgMTAuMDsgV2luNjQ7IHg2NCkgQXBwbGVXZWJLaXQvNTM3LjM2IChLSFRNTCwgbGlrZSBHZWNrbykgZGlzY29yZC8xLjAuOTE5NSBDaHJvbWUvMTM0LjAuNjk5OC4yMDUgRWxlY3Ryb24vMzUuMy4wIFNhZmFyaS81MzcuMzYiLCJicm93c2VyX3ZlcnNpb24iOiIzNS4zLjAiLCJvc19zZGtfdmVyc2lvbiI6IjIyNjIxIiwiY2xpZW50X2J1aWxkX251bWJlciI6NDA5MjE0LCJuYXRpdmVfYnVpbGRfbnVtYmVyIjo2NDYzOCwiY2xpZW50X2V2ZW50X3NvdXJjZSI6bnVsbCwiY2xpZW50X2hlYXJ0YmVhdF9zZXNzaW9uX2lkIjoiZGYyYzI0MzktOWRlNC00OGVkLTllYjctZTNlNmE2ZGYwYmY5IiwiY2xpZW50X2FwcF9zdGF0ZSI6ImZvY3VzZWQifQ=='
    }
}

async function fetchMutualGuilds(token, userId, config) {
    while (true) {
        try {
            const url = `https://discord.com/api/v9/users/${userId}/profile?type=popout&with_mutual_guilds=true&with_mutual_friends=true&with_mutual_friends_count=false`
            const response = await axios.get(url, { 
                headers: getDiscordHeaders(token),
                timeout: 10000
            })
            logAll(config, { action: 'fetchMutualGuilds', url, response: response.data })
            return response.data.mutual_guilds || []
        } catch (err) {
            if (err.response && err.response.status === 429) {
                const retry = (err.response.data.retry_after || 1) * 1000
                console.log(chalk.yellow(`Rate limited, waiting ${retry}ms...`))
                logAll(config, { action: 'fetchMutualGuilds', rateLimited: true, retry })
                await sleep(retry)
                continue
            }
            logAll(config, { action: 'fetchMutualGuilds', url, error: err.toString() })
            throw err
        }
    }
}

async function fetchGuildName(token, guildId, config) {
    while (true) {
        try {
            const url = `https://discord.com/api/v9/guilds/${guildId}`
            const response = await axios.get(url, { 
                headers: getDiscordHeaders(token),
                timeout: 10000
            })
            logAll(config, { action: 'fetchGuildName', url, response: response.data })
            return response.data.name
        } catch (err) {
            if (err.response && err.response.status === 429) {
                const retry = (err.response.data.retry_after || 1) * 1000
                console.log(chalk.yellow(`Rate limited, waiting ${retry}ms...`))
                logAll(config, { action: 'fetchGuildName', rateLimited: true, retry })
                await sleep(retry)
                continue
            }
            logAll(config, { action: 'fetchGuildName', url, error: err.toString() })
            return guildId
        }
    }
}

async function fetchChannels(token, guildId, config) {
    while (true) {
        try {
            const url = `https://discord.com/api/v9/guilds/${guildId}/channels`
            const response = await axios.get(url, {
                headers: getDiscordHeaders(token),
                timeout: 10000
            })
            logAll(config, { action: 'fetchChannels', url, response: response.data })
            return response.data.filter(c => c.type === 0)
        } catch (err) {
            if (err.response && err.response.status === 429) {
                const retry = (err.response.data.retry_after || 1) * 1000
                console.log(chalk.yellow(`Rate limited, waiting ${retry}ms...`))
                logAll(config, { action: 'fetchChannels', rateLimited: true, retry })
                await sleep(retry)
                continue
            }
            logAll(config, { action: 'fetchChannels', url, error: err.toString() })
            throw err
        }
    }
}

async function searchMessages(token, channelId, authorId, config) {
    let retryCount = 0;
    const maxRetries = 5;
    while (retryCount < maxRetries) {
        try {
            const url = `https://discord.com/api/v9/channels/${channelId}/messages/search?author_id=${authorId}`;
            const response = await axios.get(url, {
                headers: getDiscordHeaders(token),
                timeout: 10000
            });
            logAll(config, { action: 'searchMessages', url, response: response.data });
            await sleep(100);
            return response.data?.messages?.flat() || [];
        } catch (err) {
            if (err.response && err.response.status === 429) {
                const retryAfter = err.response.data.retry_after || 1;
                const retryMs = retryAfter * 1000;
                console.log(chalk.yellow(`⏳ Rate limited! Waiting ${retryAfter} seconds before retry (attempt ${retryCount + 1}/${maxRetries})...`));
                logAll(config, { action: 'searchMessages', channelId, rateLimited: true, retry: retryMs, retryCount });
                await sleep(retryMs);
                retryCount++;
                continue;
            }
            if (err.response && err.response.status === 403) {
                logAll(config, { action: 'searchMessages', channelId, error: 'No permission to access channel (403)' });
                return [];
            }
            if (retryCount < maxRetries - 1) {
                console.log(chalk.yellow(`⚠️  Error searching messages in channel ${channelId}: ${err.response?.status || err.message}. Retrying in 2 seconds... (${retryCount + 1}/${maxRetries})`));
                retryCount++;
                await sleep(2000);
                continue;
            }
            logAll(config, { action: 'searchMessages', channelId, error: err.toString(), retryCount });
            return [];
        }
    }
    return [];
}

async function searchMessagesInGuild(token, guildId, authorId, config) {
    let retryCount = 0;
    const maxRetries = 5;
    while (retryCount < maxRetries) {
        try {
            const url = `https://discord.com/api/v9/guilds/${guildId}/messages/search?author_id=${authorId}`;
            const response = await axios.get(url, {
                headers: getDiscordHeaders(token),
                timeout: 10000
            });
            logAll(config, { action: 'searchMessagesInGuild', url, response: response.data });
            await sleep(100);
            return response.data?.messages?.flat() || [];
        } catch (err) {
            if (err.response && err.response.status === 429) {
                const retryAfter = err.response.data.retry_after || 1;
                const retryMs = retryAfter * 1000;
                console.log(chalk.yellow(`⏳ Rate limited! Waiting ${retryAfter} seconds before retry (attempt ${retryCount + 1}/${maxRetries})...`));
                logAll(config, { action: 'searchMessagesInGuild', guildId, rateLimited: true, retry: retryMs, retryCount });
                await sleep(retryMs);
                retryCount++;
                continue;
            }
            if (err.response && err.response.status === 403) {
                logAll(config, { action: 'searchMessagesInGuild', guildId, error: 'No permission to access guild (403)' });
                return [];
            }
            if (retryCount < maxRetries - 1) {
                console.log(chalk.yellow(`⚠️  Error searching messages in guild ${guildId}: ${err.response?.status || err.message}. Retrying in 2 seconds... (${retryCount + 1}/${maxRetries})`));
                retryCount++;
                await sleep(2000);
                continue;
            }
            logAll(config, { action: 'searchMessagesInGuild', guildId, error: err.toString(), retryCount });
            return [];
        }
    }
    return [];
}

const pastelRed = (typeof global !== 'undefined' && global.pastelRed) || (chalk.hex ? chalk.hex('#ff5555').bold : chalk.red.bold)

const originalPrompt = inquirer.prompt
inquirer.prompt = async function(questions, ...args) {
    if (Array.isArray(questions)) {
        questions = questions.map(q => ({
            ...q,
            message: q.message ? pastelRed(q.message) : q.message,
            prefix: pastelRed('✔')
        }))
    } else if (questions && typeof questions === 'object') {
        questions.message = questions.message ? pastelRed(questions.message) : questions.message
        questions.prefix = pastelRed('✔')
    }
    return originalPrompt.call(this, questions, ...args)
}

export async function run(config) {
    let token = config && config.token ? config.token : process.env.DISCORD_TOKEN
    if (!token || token.length < 10) {
        const { inputToken } = await inquirer.prompt([
            {
                type: 'input',
                name: 'inputToken',
                message: pastelRed('Enter your Discord token:'),
                validate: input => input.length > 10
            }
        ])
        token = inputToken
    }

    const { userId } = await inquirer.prompt([
        {
            type: 'input',
            name: 'userId',
            message: pastelRed('Enter the user ID to scrape:'),
            validate: input => input.length > 10
        }
    ])

    console.log(chalk.blue('🔍 Fetching mutual guilds...'))
    const mutualGuilds = await fetchMutualGuilds(token, userId, config)
    
    if (mutualGuilds.length === 0) {
        console.log(chalk.yellow('No mutual guilds found with this user.'))
        return
    }

    console.log(chalk.blue(`📋 Found ${mutualGuilds.length} mutual guild(s), fetching names...`))
    const guildChoices = await Promise.all(mutualGuilds.map(async g => {
        const name = await fetchGuildName(token, g.id, config)
        return { name, value: g.id }
    }))

    const { guildChoice } = await inquirer.prompt([
        {
            type: 'list',
            name: 'guildChoice',
            message: pastelRed('Select a server to scrape or all:'),
            choices: [
                { name: 'All Mutual Servers', value: 'all' },
                ...guildChoices
            ]
        }
    ])

    let guildIds = []
    
    if (guildChoice === 'all') {
        guildIds = mutualGuilds.map(g => g.id)
    } else {
        guildIds = [guildChoice]
    }
    
    let totalMessages = 0
    let allMessages = []

    console.log(chalk.blue(`🚀 Starting to scrape ${guildIds.length} guild(s)...`))
    console.log(chalk.gray(`Debug: Guild IDs to process: ${guildIds.join(', ')}`))
    console.log(chalk.cyan('⚡ Using optimized guild-level search for maximum speed!\n'))

    for (const guildId of guildIds) {
        try {
            const guildName = guildChoices.find(g => g.value === guildId)?.name || guildId
            console.log(chalk.cyan(`\n📂 Processing guild: ${guildName} (ID: ${guildId})`))

            console.log(chalk.gray(`   🔍 Searching for messages from user ${userId}...`))
            const messages = await searchMessagesInGuild(token, guildId, userId, config)
            console.log(chalk.gray(`   📊 Search completed. Found ${messages.length} messages.`))
            
            if (messages.length > 0) {
                console.log(chalk.green(`   ✅ Found ${messages.length} messages in ${guildName}`))
                messages.slice(0, 3).forEach(msg => {
                    let preview = msg.content?.replace(/\n/g, ' ').substring(0, 80) + (msg.content?.length > 80 ? '...' : '')
                    console.log(chalk.gray(`      💬 ${msg.id}: ${preview}`))
                })
                if (messages.length > 3) {
                    console.log(chalk.gray(`      ... and ${messages.length - 3} more messages`))
                }
                allMessages.push(...messages)
                totalMessages += messages.length
            } else {
                console.log(chalk.yellow(`   ⚠️  No messages found in ${guildName}`))
            }
        } catch (err) {
            console.log(chalk.red(`\nFailed to process guild ${guildId}: ${err.message}`))
            console.log(chalk.red(`Error details: ${err.stack}`))
        }
    }

    process.stdout.write('\r' + ' '.repeat(80) + '\r');    if (totalMessages === 0) {
        console.log(chalk.yellow('\n🔍 SCRAPING COMPLETED - No Results'))
        console.log(chalk.yellow('⚠️  No messages found from this user in the selected servers.'))
        console.log(chalk.gray('This could mean:'))
        console.log(chalk.gray('   • The user hasn\'t sent any messages in these servers'))
        console.log(chalk.gray('   • The messages are in channels you don\'t have access to'))
        console.log(chalk.gray('   • The user ID might be incorrect'))
        console.log(chalk.green('\n✨ Press any key to return to main menu...'))
        return
    }

    if (!fs.existsSync('saves')) fs.mkdirSync('saves')
    const savePath = path.join('saves', `scrape_${userId}_${Date.now()}.json`)
    fs.writeFileSync(savePath, JSON.stringify(allMessages, null, 2), 'utf8')
    logAll(config, { action: 'saveScrape', savePath, totalMessages })
      console.log(chalk.green(`\n🎉 SCRAPING COMPLETED! 🎉`))
    console.log(chalk.green(`✅ Successfully scraped ${totalMessages} message(s) from user ${userId}`))
    console.log(chalk.blue(`💾 Results saved to: ${savePath}`))
    console.log(chalk.cyan(`\n📊 Scraping Summary:`))
    console.log(chalk.gray(`   👤 User ID: ${userId}`))
    console.log(chalk.gray(`   🏢 Servers processed: ${guildIds.length}`))
    console.log(chalk.gray(`   💬 Total messages found: ${totalMessages}`))
    console.log(chalk.gray(`   📁 Save file: ${path.basename(savePath)}`))

    try {
        await inquirer.prompt({ type: 'input', name: 'pause', message: 'Press Enter to return to menu...' })
    } catch (error) {
        console.log(chalk.red('Error while waiting to return to menu:', error.message))
        await inquirer.prompt({ type: 'input', name: 'pause', message: 'Press Enter to return to menu...' })
    }
}
