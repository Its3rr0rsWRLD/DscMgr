import inquirer from 'inquirer'
import chalk from 'chalk'
import fs from 'fs'
import discordjs from 'discord.js-selfbot-v13'

export const name = 'Find Mutual Friend in Server (Gateway)'
export const description = 'Uses the Discord Gateway to get all members in a server and checks for mutual friends with a given user ID.'

async function getToken() {
    let token = process.env.DISCORD_TOKEN
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
    return token
}

function logDebug(config, data) {
    if (config && config.debug) {
        const logLine = `[${new Date().toISOString()}] ${typeof data === 'string' ? data : JSON.stringify(data, null, 2)}\n`
        fs.appendFileSync('logs.txt', logLine)
    }
}

export async function run(config) {
    const token = await getToken()
    logDebug(config, 'Starting findMutualFriendInServer tool')
    const client = new discordjs.Client({ checkUpdate: false })
    await new Promise((resolve, reject) => {
        client.on('ready', resolve)
        client.on('error', reject)
        client.login(token)
    })
    logDebug(config, `Logged in as ${client.user?.tag}`)
    const guilds = client.guilds.cache.map(g => ({ name: g.name, value: g.id }))
    if (!guilds.length) {
        logDebug(config, 'No servers found')
        console.log(chalk.red('No servers found.'))
        process.exit(1)
    }
    const { guildId } = await inquirer.prompt([
        {
            type: 'list',
            name: 'guildId',
            message: 'Select a server:',
            choices: guilds
        }
    ])
    logDebug(config, `Selected guildId: ${guildId}`)
    const { targetId } = await inquirer.prompt([
        {
            type: 'input',
            name: 'targetId',
            message: 'Enter the Discord user ID to search for as a mutual friend:',
            validate: input => input.length > 10
        }
    ])
    logDebug(config, `Target user ID: ${targetId}`)
    const guild = client.guilds.cache.get(guildId)
    if (!guild) {
        logDebug(config, 'Guild not found')
        console.log(chalk.red('Guild not found.'))
        process.exit(1)
    }
    console.log(chalk.blue('Fetching all members (this may take a while for large servers)...'))
    await guild.members.fetch({ force: true })
    logDebug(config, `Fetched ${guild.members.cache.size} members`)
    const members = guild.members.cache
    console.log(chalk.green(`Fetched ${members.size} members.`))
    const axios = require('axios')
    const getDiscordHeaders = (token) => ({
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
    })
    let mutualFriends = []
    let retry = 0
    while (retry < 5) {
        try {
            const res = await axios.get(`https://discord.com/api/v9/users/${targetId}/profile?type=popout&with_mutual_guilds=true&with_mutual_friends=true&with_mutual_friends_count=false`, {
                headers: getDiscordHeaders(token),
                timeout: 10000
            })
            logDebug(config, { action: 'fetchMutualFriends', response: res.data })
            mutualFriends = res.data.mutual_friends || []
            break
        } catch (err) {
            logDebug(config, { action: 'fetchMutualFriends', error: err.toString() })
            if (err.response && err.response.status === 429) {
                const wait = (err.response.data.retry_after || 1) * 1000
                await new Promise(r => setTimeout(r, wait))
                retry++
            } else {
                throw err
            }
        }
    }
    const memberIds = new Set(members.map(m => m.id))
    const found = mutualFriends.filter(f => memberIds.has(f.id))
    logDebug(config, { foundCount: found.length, found })
    if (found.length === 0) {
        console.log(chalk.yellow('No members in this server are mutual friends with the specified user.'))
    } else {
        console.log(chalk.green(`Found ${found.length} member(s) in this server who are mutual friends with ${targetId}:`))
        for (const f of found) {
            console.log(`- ${f.user.username}#${f.user.discriminator} (${f.id})`)
        }
    }
    client.destroy()
}
