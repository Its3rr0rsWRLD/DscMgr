import inquirer from 'inquirer'
import axios from 'axios'
import chalk from 'chalk'
import fs from 'fs'
import path from 'path'
import { HttpsProxyAgent } from 'https-proxy-agent'

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

function loadProxiesFromFile() {
    try {
        if (fs.existsSync('proxies.txt')) {
            const content = fs.readFileSync('proxies.txt', 'utf8')
            const proxies = content.split('\n').filter(p => p.trim())
            return proxies
        }
    } catch (error) {
        console.log(chalk.yellow('Warning: Could not load proxies from proxies.txt'))
    }
    return []
}

function getRandomProxy(proxies) {
    if (!proxies || proxies.length === 0) return null
    return proxies[Math.floor(Math.random() * proxies.length)]
}

function createProxyAxiosConfig(config) {
    if (!config.proxiesEnabled) return {}
    
    const proxies = loadProxiesFromFile()
    if (proxies.length === 0) {
        console.log(chalk.yellow('No proxies available in proxies.txt'))
        return {}
    }
    
    const proxy = getRandomProxy(proxies)
    if (!proxy) return {}
    
    try {
        return {
            httpsAgent: new HttpsProxyAgent(`http://${proxy}`),
            httpAgent: new HttpsProxyAgent(`http://${proxy}`)
        }
    } catch (error) {
        console.log(chalk.yellow(`Failed to create proxy agent: ${error.message}`))
        return {}
    }
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
            const proxyConfig = createProxyAxiosConfig(config)
            const response = await axios.get(url, { 
                headers: getDiscordHeaders(token),
                ...proxyConfig,
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
            const proxyConfig = createProxyAxiosConfig(config)
            const response = await axios.get(url, { 
                headers: getDiscordHeaders(token),
                ...proxyConfig,
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
            const proxyConfig = createProxyAxiosConfig(config)
            const response = await axios.get(url, {
                headers: getDiscordHeaders(token),
                ...proxyConfig,
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
    while (true) {
        try {
            const url = `https://discord.com/api/v9/channels/${channelId}/messages/search?author_id=${authorId}`
            const proxyConfig = createProxyAxiosConfig(config)
            const response = await axios.get(url, { 
                headers: getDiscordHeaders(token),
                ...proxyConfig,
                timeout: 10000
            })
            logAll(config, { action: 'searchMessages', url, response: response.data })
            
            // Add a small delay to prevent overwhelming the API
            await sleep(100)
            
            return response.data?.messages?.flat() || []
        } catch (err) {
            if (err.response && err.response.status === 429) {
                const retry = (err.response.data.retry_after || 1) * 1000
                console.log(chalk.yellow(`Rate limited, waiting ${retry}ms...`))
                logAll(config, { action: 'searchMessages', rateLimited: true, retry })
                await sleep(retry)
                continue
            }
            if (err.response && err.response.status === 403) {
                logAll(config, { action: 'searchMessages', channelId, error: 'No permission to access channel (403)' })
                return []
            }
            logAll(config, { action: 'searchMessages', url, error: err.toString() })
            return []
        }
    }
}

export async function run(config) {
    let token = config && config.token ? config.token : process.env.DISCORD_TOKEN
    if (!token || token.length < 10) {
        const { inputToken } = await inquirer.prompt([
            {
                type: 'input',
                name: 'inputToken',
                message: 'Enter your Discord token:',
                validate: input => input.length > 10
            }
        ])
        token = inputToken
    }

    const { userId } = await inquirer.prompt([
        {
            type: 'input',
            name: 'userId',
            message: 'Enter the user ID to scrape:',
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
            message: 'Select a server to scrape or all:',
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
    let processedChannels = 0
    let totalChannels = 0

    // First, count total channels for progress
    console.log(chalk.blue('📊 Calculating total channels to process...'))
    for (const guildId of guildIds) {
        try {
            const channels = await fetchChannels(token, guildId, config)
            totalChannels += channels.length
        } catch (err) {
            console.log(chalk.red(`Failed to fetch channels for guild ${guildId}: ${err.message}`))
        }
    }

    console.log(chalk.blue(`🚀 Starting to scrape ${totalChannels} channels across ${guildIds.length} guild(s)...`))

    for (const guildId of guildIds) {
        try {
            const guildName = guildChoices.find(g => g.value === guildId)?.name || guildId
            console.log(chalk.cyan(`\n📂 Processing guild: ${guildName}`))
            
            const channels = await fetchChannels(token, guildId, config)
            
            for (const channel of channels) {
                processedChannels++
                const progress = `(${processedChannels}/${totalChannels})`
                process.stdout.write(`\r${chalk.gray(`   📈 ${progress} Checking channel: ${channel.name}...`)}`);
                
                try {
                    const messages = await searchMessages(token, channel.id, userId, config)
                    if (messages.length > 0) {
                        console.log(`\n${chalk.green(`   ✅ Found ${messages.length} messages in #${channel.name}`)}`);
                        
                        // Show preview of messages found
                        messages.slice(0, 3).forEach(msg => {
                            let preview = msg.content?.replace(/\n/g, ' ').substring(0, 80) + (msg.content?.length > 80 ? '...' : '')
                            console.log(chalk.gray(`      💬 ${msg.id}: ${preview}`))
                        })
                        
                        if (messages.length > 3) {
                            console.log(chalk.gray(`      ... and ${messages.length - 3} more messages`))
                        }
                        
                        allMessages.push(...messages)
                        totalMessages += messages.length
                    }
                } catch (err) {
                    console.log(`\n${chalk.yellow(`   ⚠️  Skipped channel #${channel.name}: ${err.message}`)}`);
                }
            }
        } catch (err) {
            console.log(chalk.red(`\nFailed to process guild ${guildId}: ${err.message}`))
        }
    }

    // Clear the progress line
    process.stdout.write('\r' + ' '.repeat(80) + '\r');

    if (totalMessages === 0) {
        console.log(chalk.yellow('\n🔍 No messages found from this user in the selected servers.'))
        return
    }

    // Save results
    if (!fs.existsSync('saves')) fs.mkdirSync('saves')
    const savePath = path.join('saves', `scrape_${userId}_${Date.now()}.json`)
    fs.writeFileSync(savePath, JSON.stringify(allMessages, null, 2), 'utf8')
    logAll(config, { action: 'saveScrape', savePath, totalMessages })
    
    console.log(chalk.green(`\n🎉 Successfully scraped ${totalMessages} message(s) from user ${userId}`))
    console.log(chalk.blue(`💾 Results saved to: ${savePath}`))
}
