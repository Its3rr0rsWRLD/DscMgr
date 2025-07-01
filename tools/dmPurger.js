import inquirer from 'inquirer'
import axios from 'axios'
import chalk from 'chalk'
import fs from 'fs'

export const name = 'DM Purger'
export const description = 'Delete all messages from a DM conversation.'

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
        'content-type': 'application/json',
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

async function fetchDMChannels(token, config) {
    while (true) {
        try {
            const response = await axios.get('https://discord.com/api/v9/users/@me/channels', {
                headers: getDiscordHeaders(token),
                timeout: 10000
            })
            logAll(config, { action: 'fetchDMChannels', count: response.data.length })
            return response.data
        } catch (err) {
            if (err.response && err.response.status === 429) {
                const retry = (err.response.data.retry_after || 1) * 1000
                await sleep(retry)
                continue
            }
            throw err
        }
    }
}

async function fetchMessages(channelId, token, config, beforeId = null) {
    while (true) {
        try {
            const url = beforeId 
                ? `https://discord.com/api/v9/channels/${channelId}/messages?limit=100&before=${beforeId}`
                : `https://discord.com/api/v9/channels/${channelId}/messages?limit=100`
            const response = await axios.get(url, {
                headers: getDiscordHeaders(token),
                timeout: 10000
            })
            logAll(config, { action: 'fetchMessages', channelId, count: response.data.length })
            return response.data
        } catch (err) {
            if (err.response && err.response.status === 429) {
                const retry = (err.response.data.retry_after || 1) * 1000
                await sleep(retry)
                continue
            }
            throw err
        }
    }
}

async function deleteMessage(channelId, messageId, token, config) {
    while (true) {
        try {
            await axios.delete(`https://discord.com/api/v9/channels/${channelId}/messages/${messageId}`, {
                headers: getDiscordHeaders(token),
                timeout: 10000
            })
            return { success: true, rateLimited: false }
        } catch (err) {
            if (err.response && err.response.status === 429) {
                const retryAfter = err.response.data.retry_after || 1
                const retryMs = Math.ceil(retryAfter * 1000)
                await sleep(retryMs)
                return { success: true, rateLimited: true, retryAfter: retryMs }
            }
            if (err.response && err.response.status === 404) {
                return { success: false, rateLimited: false }
            }
            throw err
        }
    }
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
                message: 'Enter your Discord token:',
                validate: input => input.length > 10
            }
        ])
        token = inputToken
    }

    console.log(chalk.blue('📥 Fetching DM channels...'))
    const dmChannels = await fetchDMChannels(token, config)
    
    if (dmChannels.length === 0) {
        console.log(chalk.yellow('No DM channels found.'))
        return
    }

    const { searchType } = await inquirer.prompt([
        {
            type: 'list',
            name: 'searchType',
            message: 'How would you like to select the DM?',
            choices: [
                { name: 'Search by username', value: 'search' },
                { name: 'Select from list', value: 'list' }
            ]
        }
    ])

    let selectedChannel
    if (searchType === 'search') {
        const { searchQuery } = await inquirer.prompt([
            {
                type: 'input',
                name: 'searchQuery',
                message: 'Enter username to search for:',
                validate: input => input.length > 0
            }
        ])
        
        const matches = dmChannels.filter(ch => 
            ch.recipients && ch.recipients.some(r => 
                r.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
                r.global_name?.toLowerCase().includes(searchQuery.toLowerCase())
            )
        )
        
        if (matches.length === 0) {
            console.log(chalk.red('No matching DMs found.'))
            return
        }
        
        if (matches.length === 1) {
            selectedChannel = matches[0]
        } else {
            const { channelId } = await inquirer.prompt([
                {
                    type: 'list',
                    name: 'channelId',
                    message: 'Multiple matches found, select one:',
                    choices: matches.map(ch => ({
                        name: ch.recipients[0]?.username || 'Unknown User',
                        value: ch.id
                    }))
                }
            ])
            selectedChannel = matches.find(ch => ch.id === channelId)
        }
    } else {
        const { channelId } = await inquirer.prompt([
            {
                type: 'list',
                name: 'channelId',
                message: 'Select a DM to purge:',
                choices: dmChannels.map(ch => ({
                    name: ch.recipients[0]?.username || 'Unknown User',
                    value: ch.id
                }))
            }
        ])
        selectedChannel = dmChannels.find(ch => ch.id === channelId)
    }

    const recipientName = selectedChannel.recipients[0]?.username || 'Unknown User'
    
    const { confirm } = await inquirer.prompt([
        {
            type: 'confirm',
            name: 'confirm',
            message: `Are you sure you want to delete ALL your messages with ${recipientName}? This cannot be undone.`,
            default: true
        }
    ])

    if (!confirm) {
        console.log(chalk.yellow('Operation cancelled.'))
        return
    }

    console.log(chalk.blue(`🗑️ Purging messages with ${recipientName}...`))
    
    let totalDeleted = 0
    let beforeId = null
    let currentUser = null
    let consecutiveSuccesses = 0
    let baseDelay = 250
    let currentDelay = baseDelay

    try {
        const userResponse = await axios.get('https://discord.com/api/v9/users/@me', {
            headers: getDiscordHeaders(token)
        })
        currentUser = userResponse.data
    } catch {
        console.log(chalk.yellow('Could not fetch user info, continuing anyway...'))
    }

    while (true) {
        const messages = await fetchMessages(selectedChannel.id, token, config, beforeId)
        
        if (messages.length === 0) break

        const myMessages = currentUser 
            ? messages.filter(msg => msg.author.id === currentUser.id)
            : messages

        if (myMessages.length === 0) {
            beforeId = messages[messages.length - 1].id
            continue
        }

        for (const message of myMessages) {
            try {
                const result = await deleteMessage(selectedChannel.id, message.id, token, config)
                if (result.success) {
                    totalDeleted++
                    process.stdout.write(`\rDeleted: ${totalDeleted} messages`)
                    
                    if (result.rateLimited) {
                        consecutiveSuccesses = 0
                        currentDelay = 1000
                    } else {
                        consecutiveSuccesses++
                        if (consecutiveSuccesses >= 3) {
                            currentDelay = Math.max(10, currentDelay * 0.5)
                            consecutiveSuccesses = 0
                        }
                        await sleep(currentDelay)
                    }
                }
            } catch (error) {
                consecutiveSuccesses = 0
                currentDelay = baseDelay
                logAll(config, { action: 'deleteMessage', error: error.toString(), messageId: message.id })
            }
        }

        beforeId = messages[messages.length - 1].id
        
        if (messages.length < 100) break
    }

    process.stdout.write('\n')
    console.log(chalk.green(`\n🎉 DM PURGE COMPLETED! 🎉`))
    console.log(chalk.green(`✅ Successfully deleted ${totalDeleted} messages with ${recipientName}`))
    console.log(chalk.cyan(`\n📊 Purge Summary:`))
    console.log(chalk.gray(`   👤 User: ${recipientName}`))
    console.log(chalk.gray(`   💬 Messages deleted: ${totalDeleted}`))

    try {
        await inquirer.prompt({ type: 'input', name: 'pause', message: 'Press Enter to return to menu...' })
    } catch (error) {
        logAll(config, { action: 'pauseError', error: error.toString() })
        console.log(chalk.red('Error while waiting to return to menu.'))
        await inquirer.prompt({ type: 'input', name: 'pause', message: 'Press Enter to return to menu...' })
    }
}
