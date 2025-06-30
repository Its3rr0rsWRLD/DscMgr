import inquirer from 'inquirer'
import axios from 'axios'
import chalk from 'chalk'
import fs from 'fs'
import path from 'path'

export const name = 'Server Saver'
export const description = 'Save all server data (channels, roles, emojis, settings) to JSON for cloning.'

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

async function fetchGuildInfo(guildId, token, config) {
    while (true) {
        try {
            const response = await axios.get(`https://discord.com/api/v9/guilds/${guildId}`, {
                headers: getDiscordHeaders(token),
                timeout: 10000
            })
            logAll(config, { action: 'fetchGuildInfo', guildId, response: response.data })
            return response.data
        } catch (err) {
            if (err.response && err.response.status === 429) {
                const retry = (err.response.data.retry_after || 1) * 1000
                console.log(chalk.yellow(`Rate limited, waiting ${retry}ms...`))
                await sleep(retry)
                continue
            }
            logAll(config, { action: 'fetchGuildInfo', guildId, error: err.toString() })
            throw err
        }
    }
}

async function fetchGuildChannels(guildId, token, config) {
    while (true) {
        try {
            const response = await axios.get(`https://discord.com/api/v9/guilds/${guildId}/channels`, {
                headers: getDiscordHeaders(token),
                timeout: 10000
            })
            logAll(config, { action: 'fetchGuildChannels', guildId, channelCount: response.data.length })
            return response.data
        } catch (err) {
            if (err.response && err.response.status === 429) {
                const retry = (err.response.data.retry_after || 1) * 1000
                console.log(chalk.yellow(`Rate limited, waiting ${retry}ms...`))
                await sleep(retry)
                continue
            }
            logAll(config, { action: 'fetchGuildChannels', guildId, error: err.toString() })
            throw err
        }
    }
}

async function fetchGuildRoles(guildId, token, config) {
    while (true) {
        try {
            const response = await axios.get(`https://discord.com/api/v9/guilds/${guildId}/roles`, {
                headers: getDiscordHeaders(token),
                timeout: 10000
            })
            logAll(config, { action: 'fetchGuildRoles', guildId, roleCount: response.data.length })
            return response.data
        } catch (err) {
            if (err.response && err.response.status === 429) {
                const retry = (err.response.data.retry_after || 1) * 1000
                console.log(chalk.yellow(`Rate limited, waiting ${retry}ms...`))
                await sleep(retry)
                continue
            }
            logAll(config, { action: 'fetchGuildRoles', guildId, error: err.toString() })
            throw err
        }
    }
}

async function fetchGuildEmojis(guildId, token, config) {
    while (true) {
        try {
            const response = await axios.get(`https://discord.com/api/v9/guilds/${guildId}/emojis`, {
                headers: getDiscordHeaders(token),
                timeout: 10000
            })
            logAll(config, { action: 'fetchGuildEmojis', guildId, emojiCount: response.data.length })
            return response.data
        } catch (err) {
            if (err.response && err.response.status === 429) {
                const retry = (err.response.data.retry_after || 1) * 1000
                console.log(chalk.yellow(`Rate limited, waiting ${retry}ms...`))
                await sleep(retry)
                continue
            }
            logAll(config, { action: 'fetchGuildEmojis', guildId, error: err.toString() })
            throw err
        }
    }
}

async function fetchGuildStickers(guildId, token, config) {
    while (true) {
        try {
            const response = await axios.get(`https://discord.com/api/v9/guilds/${guildId}/stickers`, {
                headers: getDiscordHeaders(token),
                timeout: 10000
            })
            logAll(config, { action: 'fetchGuildStickers', guildId, stickerCount: response.data.length })
            return response.data
        } catch (err) {
            if (err.response && err.response.status === 429) {
                const retry = (err.response.data.retry_after || 1) * 1000
                console.log(chalk.yellow(`Rate limited, waiting ${retry}ms...`))
                await sleep(retry)
                continue
            }
            logAll(config, { action: 'fetchGuildStickers', guildId, error: err.toString() })
            return []
        }
    }
}

async function fetchMutualGuilds(token, config) {
    while (true) {
        try {
            const url = `https://discord.com/api/v9/users/@me/guilds`
            const response = await axios.get(url, {
                headers: getDiscordHeaders(token),
                timeout: 10000
            })
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

    console.log(chalk.blue('🔍 Fetching your servers...'))
    const guilds = await fetchMutualGuilds(token, config)
    
    if (guilds.length === 0) {
        console.log(chalk.yellow('No servers found.'))
        return
    }

    const { guildId } = await inquirer.prompt([
        {
            type: 'list',
            name: 'guildId',
            message: 'Select a server to save:',
            choices: guilds.map(g => ({ name: g.name, value: g.id }))
        }
    ])

    console.log(chalk.blue('📡 Fetching server data...'))
    
    try {
        console.log(chalk.yellow('   📋 Fetching server info...'))
        const guildInfo = await fetchGuildInfo(guildId, token, config)
        
        console.log(chalk.yellow('   📁 Fetching channels...'))
        const channels = await fetchGuildChannels(guildId, token, config)
        
        console.log(chalk.yellow('   🎭 Fetching roles...'))
        const roles = await fetchGuildRoles(guildId, token, config)
        
        console.log(chalk.yellow('   😀 Fetching emojis...'))
        const emojis = await fetchGuildEmojis(guildId, token, config)
        
        console.log(chalk.yellow('   🎨 Fetching stickers...'))
        const stickers = await fetchGuildStickers(guildId, token, config)

        const serverData = {
            metadata: {
                savedAt: new Date().toISOString(),
                savedBy: 'Ryzor.cc Server Saver',
                version: '1.0.0'
            },
            guild: {
                id: guildInfo.id,
                name: guildInfo.name,
                description: guildInfo.description,
                icon: guildInfo.icon,
                splash: guildInfo.splash,
                discovery_splash: guildInfo.discovery_splash,
                banner: guildInfo.banner,
                owner_id: guildInfo.owner_id,
                region: guildInfo.region,
                verification_level: guildInfo.verification_level,
                default_message_notifications: guildInfo.default_message_notifications,
                explicit_content_filter: guildInfo.explicit_content_filter,
                mfa_level: guildInfo.mfa_level,
                system_channel_id: guildInfo.system_channel_id,
                system_channel_flags: guildInfo.system_channel_flags,
                rules_channel_id: guildInfo.rules_channel_id,
                public_updates_channel_id: guildInfo.public_updates_channel_id,
                preferred_locale: guildInfo.preferred_locale,
                features: guildInfo.features,
                premium_tier: guildInfo.premium_tier,
                premium_subscription_count: guildInfo.premium_subscription_count,
                vanity_url_code: guildInfo.vanity_url_code,
                nsfw_level: guildInfo.nsfw_level
            },
            channels: channels.map(ch => ({
                id: ch.id,
                name: ch.name,
                type: ch.type,
                position: ch.position,
                parent_id: ch.parent_id,
                topic: ch.topic,
                nsfw: ch.nsfw,
                rate_limit_per_user: ch.rate_limit_per_user,
                bitrate: ch.bitrate,
                user_limit: ch.user_limit,
                permission_overwrites: ch.permission_overwrites,
                rtc_region: ch.rtc_region,
                video_quality_mode: ch.video_quality_mode,
                default_auto_archive_duration: ch.default_auto_archive_duration,
                flags: ch.flags
            })),
            roles: roles.map(role => ({
                id: role.id,
                name: role.name,
                color: role.color,
                hoist: role.hoist,
                position: role.position,
                permissions: role.permissions,
                managed: role.managed,
                mentionable: role.mentionable,
                tags: role.tags,
                flags: role.flags
            })),
            emojis: emojis.map(emoji => ({
                id: emoji.id,
                name: emoji.name,
                roles: emoji.roles,
                user: emoji.user,
                require_colons: emoji.require_colons,
                managed: emoji.managed,
                animated: emoji.animated,
                available: emoji.available
            })),
            stickers: stickers.map(sticker => ({
                id: sticker.id,
                name: sticker.name,
                description: sticker.description,
                tags: sticker.tags,
                type: sticker.type,
                format_type: sticker.format_type,
                available: sticker.available,
                guild_id: sticker.guild_id,
                user: sticker.user,
                sort_value: sticker.sort_value
            })),
            stats: {
                channelCount: channels.length,
                roleCount: roles.length,
                emojiCount: emojis.length,
                stickerCount: stickers.length,
                categoryCount: channels.filter(ch => ch.type === 4).length,
                textChannelCount: channels.filter(ch => ch.type === 0).length,
                voiceChannelCount: channels.filter(ch => ch.type === 2).length
            }
        }

        if (!fs.existsSync('saves')) {
            fs.mkdirSync('saves')
        }

        const timestamp = Date.now()
        const filename = `server_${guildInfo.name.replace(/[^a-zA-Z0-9]/g, '_')}_${guildId}_${timestamp}.json`
        const filepath = path.join('saves', filename)
        
        fs.writeFileSync(filepath, JSON.stringify(serverData, null, 2), 'utf8')
        
        console.log(chalk.green('\n🎉 SERVER SAVE COMPLETED! 🎉'))
        console.log(chalk.green(`✅ Successfully saved "${guildInfo.name}" server data`))
        console.log(chalk.blue(`💾 Saved to: ${filepath}`))
        console.log(chalk.cyan(`\n📊 Save Summary:`))
        console.log(chalk.gray(`   🏢 Server: ${guildInfo.name} (${guildId})`))
        console.log(chalk.gray(`   📁 Categories: ${serverData.stats.categoryCount}`))
        console.log(chalk.gray(`   💬 Text Channels: ${serverData.stats.textChannelCount}`))
        console.log(chalk.gray(`   🔊 Voice Channels: ${serverData.stats.voiceChannelCount}`))
        console.log(chalk.gray(`   🎭 Roles: ${serverData.stats.roleCount}`))
        console.log(chalk.gray(`   😀 Emojis: ${serverData.stats.emojiCount}`))
        console.log(chalk.gray(`   🎨 Stickers: ${serverData.stats.stickerCount}`))
        console.log(chalk.gray(`   📄 File size: ${(fs.statSync(filepath).size / 1024).toFixed(2)} KB`))
        console.log(chalk.green(`\n✨ Server data saved! This file can be used to clone the server later.`))
        
        logAll(config, { action: 'serverSaveCompleted', filepath, stats: serverData.stats })
        await inquirer.prompt({ type: 'input', name: 'pause', message: 'Press Enter to return to menu...' })
    } catch (error) {
        console.log(chalk.red(`\n❌ Save failed: ${error.message}`))
        console.log(chalk.yellow('Check the logs for more details.'))
        logAll(config, { action: 'serverSaveFailed', error: error.toString() })
        await inquirer.prompt({ type: 'input', name: 'pause', message: 'Press Enter to return to menu...' })
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
