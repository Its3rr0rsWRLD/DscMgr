import inquirer from 'inquirer'
import axios from 'axios'
import chalk from 'chalk'
import fs from 'fs'

export const name = 'Clone Server'
export const description = 'Clone channels, roles, and settings from one server to another.'

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
            logAll(config, { action: 'fetchGuildChannels', guildId, response: response.data })
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
            logAll(config, { action: 'fetchGuildRoles', guildId, response: response.data })
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

async function createRole(guildId, roleData, token, config) {
    while (true) {
        try {
            const cleanRoleData = {
                name: roleData.name,
                color: roleData.color,
                hoist: roleData.hoist,
                mentionable: roleData.mentionable,
                permissions: roleData.permissions
            }
            
            const response = await axios.post(`https://discord.com/api/v9/guilds/${guildId}/roles`, cleanRoleData, {
                headers: getDiscordHeaders(token),
                timeout: 10000
            })
            logAll(config, { action: 'createRole', guildId, roleData: cleanRoleData, response: response.data })
            return response.data
        } catch (err) {
            if (err.response && err.response.status === 429) {
                const retry = (err.response.data.retry_after || 1) * 1000
                console.log(chalk.yellow(`Rate limited, waiting ${retry}ms...`))
                await sleep(retry)
                continue
            }
            logAll(config, { action: 'createRole', guildId, roleData, error: err.toString() })
            throw err
        }
    }
}

async function createChannel(guildId, channelData, token, config) {
    while (true) {
        try {
            const cleanChannelData = {
                name: channelData.name,
                type: channelData.type,
                topic: channelData.topic,
                nsfw: channelData.nsfw,
                rate_limit_per_user: channelData.rate_limit_per_user,
                position: channelData.position,
                parent_id: channelData.parent_id,
                permission_overwrites: channelData.permission_overwrites || []
            }
            
            const response = await axios.post(`https://discord.com/api/v9/guilds/${guildId}/channels`, cleanChannelData, {
                headers: getDiscordHeaders(token),
                timeout: 10000
            })
            logAll(config, { action: 'createChannel', guildId, channelData: cleanChannelData, response: response.data })
            return response.data
        } catch (err) {
            if (err.response && err.response.status === 429) {
                const retry = (err.response.data.retry_after || 1) * 1000
                console.log(chalk.yellow(`Rate limited, waiting ${retry}ms...`))
                await sleep(retry)
                continue
            }
            logAll(config, { action: 'createChannel', guildId, channelData, error: err.toString() })
            throw err
        }
    }
}

async function updateGuildSettings(guildId, guildData, token, config) {
    while (true) {
        try {
            const cleanGuildData = {
                name: guildData.name,
                description: guildData.description,
                verification_level: guildData.verification_level,
                default_message_notifications: guildData.default_message_notifications,
                explicit_content_filter: guildData.explicit_content_filter
            }
            
            const response = await axios.patch(`https://discord.com/api/v9/guilds/${guildId}`, cleanGuildData, {
                headers: getDiscordHeaders(token),
                timeout: 10000
            })
            logAll(config, { action: 'updateGuildSettings', guildId, guildData: cleanGuildData, response: response.data })
            return response.data
        } catch (err) {
            if (err.response && err.response.status === 429) {
                const retry = (err.response.data.retry_after || 1) * 1000
                console.log(chalk.yellow(`Rate limited, waiting ${retry}ms...`))
                await sleep(retry)
                continue
            }
            logAll(config, { action: 'updateGuildSettings', guildId, guildData, error: err.toString() })
            throw err
        }
    }
}

async function clearTargetServer(guildId, token, config) {
    while (true) {
        try {
            let emojis = []
            try {
                const emojiRes = await axios.get(`https://discord.com/api/v9/guilds/${guildId}/emojis`, {
                    headers: getDiscordHeaders(token),
                    timeout: 10000
                })
                emojis = emojiRes.data
            } catch {}
            for (const emoji of emojis) {
                let retry = 0
                while (retry < 5) {
                    try {
                        await axios.delete(`https://discord.com/api/v9/guilds/${guildId}/emojis/${emoji.id}`, {
                            headers: getDiscordHeaders(token),
                            timeout: 10000
                        })
                        break
                    } catch (err) {
                        if (err.response && err.response.status === 429) {
                            const wait = (err.response.data.retry_after || 1) * 1000
                            await sleep(wait)
                            retry++
                        } else {
                            break
                        }
                    }
                }
            }
            let channels = []
            try {
                const chRes = await axios.get(`https://discord.com/api/v9/guilds/${guildId}/channels`, {
                    headers: getDiscordHeaders(token),
                    timeout: 10000
                })
                channels = chRes.data
            } catch {}
            for (const ch of channels) {
                let retry = 0
                while (retry < 5) {
                    try {
                        await axios.delete(`https://discord.com/api/v9/channels/${ch.id}`, {
                            headers: getDiscordHeaders(token),
                            timeout: 10000
                        })
                        break
                    } catch (err) {
                        if (err.response && err.response.status === 429) {
                            const wait = (err.response.data.retry_after || 1) * 1000
                            await sleep(wait)
                            retry++
                        } else {
                            break
                        }
                    }
                }
            }
            let roles = []
            try {
                const roleRes = await axios.get(`https://discord.com/api/v9/guilds/${guildId}/roles`, {
                    headers: getDiscordHeaders(token),
                    timeout: 10000
                })
                roles = roleRes.data
            } catch {}
            for (const role of roles.filter(r => r.name !== '@everyone')) {
                let retry = 0
                while (retry < 5) {
                    try {
                        await axios.delete(`https://discord.com/api/v9/guilds/${guildId}/roles/${role.id}`, {
                            headers: getDiscordHeaders(token),
                            timeout: 10000
                        })
                        break
                    } catch (err) {
                        if (err.response && err.response.status === 429) {
                            const wait = (err.response.data.retry_after || 1) * 1000
                            await sleep(wait)
                            retry++
                        } else {
                            break
                        }
                    }
                }
            }
            return
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

    const { sourceGuildId } = await inquirer.prompt([
        {
            type: 'input',
            name: 'sourceGuildId',
            message: pastelRed('Enter the source server ID (to clone FROM):'),
            validate: input => input.length > 10
        }
    ])

    const { targetGuildId } = await inquirer.prompt([
        {
            type: 'input',
            name: 'targetGuildId',
            message: pastelRed('Enter the target server ID (to clone TO):'),
            validate: input => input.length > 10
        }
    ])

    console.log(chalk.blue('🔄 Starting server clone process...'))
    
    try {
        console.log(chalk.yellow('📡 Fetching source server data...'))
        const sourceGuild = await fetchGuildInfo(sourceGuildId, token, config)
        const sourceChannels = await fetchGuildChannels(sourceGuildId, token, config)
        const sourceRoles = await fetchGuildRoles(sourceGuildId, token, config)
        
        console.log(chalk.green(`✅ Source server: ${sourceGuild.name}`))
        console.log(chalk.gray(`   📝 ${sourceChannels.length} channels, ${sourceRoles.length} roles`))
        
        const targetGuild = await fetchGuildInfo(targetGuildId, token, config)
        console.log(chalk.green(`✅ Target server: ${targetGuild.name}`))

        const { confirm } = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'confirm',
                message: `${pastelRed('Are you sure you want to clone')} "${sourceGuild.name}" ${pastelRed('into')} "${targetGuild.name}"? ${pastelRed('This will DELETE all channels, roles, and emojis in the target server and create new ones.')}`,
                default: true
            }
        ])
        if (!confirm) {
            console.log(chalk.yellow('❌ Clone cancelled.'))
            return
        }
        console.log(chalk.blue('🧹 Clearing target server (roles, channels, emojis)...'))
        await clearTargetServer(targetGuildId, token, config)
        console.log(chalk.green('✅ Target server cleared.'))

        const sourceEveryone = sourceRoles.find(r => r.name === '@everyone')
        const targetRoles = await fetchGuildRoles(targetGuildId, token, config)
        const targetEveryone = targetRoles.find(r => r.name === '@everyone')
        if (sourceEveryone && targetEveryone) {
            let retry = 0
            while (retry < 5) {
                try {
                    await axios.patch(`https://discord.com/api/v9/guilds/${targetGuildId}/roles/${targetEveryone.id}`, {
                        permissions: sourceEveryone.permissions
                    }, {
                        headers: getDiscordHeaders(token),
                        timeout: 10000
                    })
                    break
                } catch (err) {
                    if (err.response && err.response.status === 429) {
                        const wait = (err.response.data.retry_after || 1) * 1000
                        await sleep(wait)
                        retry++
                    } else {
                        break
                    }
                }
            }
            console.log(chalk.green('✅ @everyone role permissions updated to match source.'))
        }

        console.log(chalk.blue('\n🎭 Cloning roles...'))
        const roleMapping = {}
        const rolesToClone = sourceRoles.filter(role => role.name !== '@everyone').reverse()
        
        for (let i = 0; i < rolesToClone.length; i++) {
            const role = rolesToClone[i]
            try {
                console.log(chalk.yellow(`   (${i + 1}/${rolesToClone.length}) Creating role: ${role.name}`))
                const newRole = await createRole(targetGuildId, role, token, config)
                roleMapping[role.id] = newRole.id
                console.log(chalk.green(`   ✅ Created role: ${newRole.name}`))
                await sleep(1000)
            } catch (error) {
                console.log(chalk.red(`   ❌ Failed to create role ${role.name}: ${error.message}`))
            }
        }
        
        console.log(chalk.blue('\n📁 Cloning categories...'))
        const categoryMapping = {}
        const categories = sourceChannels.filter(ch => ch.type === 4).sort((a, b) => a.position - b.position)
        
        for (let i = 0; i < categories.length; i++) {
            const category = categories[i]
            try {
                console.log(chalk.yellow(`   (${i + 1}/${categories.length}) Creating category: ${category.name}`))
                
                const updatedOverwrites = category.permission_overwrites?.map(overwrite => ({
                    ...overwrite,
                    id: roleMapping[overwrite.id] || overwrite.id
                })) || []
                
                const newCategory = await createChannel(targetGuildId, {
                    ...category,
                    permission_overwrites: updatedOverwrites
                }, token, config)
                
                categoryMapping[category.id] = newCategory.id
                console.log(chalk.green(`   ✅ Created category: ${newCategory.name}`))
                await sleep(1000)
            } catch (error) {
                console.log(chalk.red(`   ❌ Failed to create category ${category.name}: ${error.message}`))
            }
        }
        
        console.log(chalk.blue('\n💬 Cloning channels...'))
        const regularChannels = sourceChannels.filter(ch => ch.type !== 4).sort((a, b) => a.position - b.position)
        
        for (let i = 0; i < regularChannels.length; i++) {
            const channel = regularChannels[i]
            try {
                console.log(chalk.yellow(`   (${i + 1}/${regularChannels.length}) Creating channel: ${channel.name}`))
                
                const updatedOverwrites = channel.permission_overwrites?.map(overwrite => ({
                    ...overwrite,
                    id: roleMapping[overwrite.id] || overwrite.id
                })) || []
                
                await createChannel(targetGuildId, {
                    ...channel,
                    parent_id: categoryMapping[channel.parent_id] || null,
                    permission_overwrites: updatedOverwrites
                }, token, config)
                
                console.log(chalk.green(`   ✅ Created channel: ${channel.name}`))
                await sleep(1000)
            } catch (error) {
                console.log(chalk.red(`   ❌ Failed to create channel ${channel.name}: ${error.message}`))
            }
        }
        
        console.log(chalk.blue('\n⚙️ Updating server settings...'))
        try {
            await updateGuildSettings(targetGuildId, { ...sourceGuild, name: sourceGuild.name }, token, config)
            console.log(chalk.green('   ✅ Updated server settings'))
        } catch (error) {
            console.log(chalk.red(`   ❌ Failed to update server settings: ${error.message}`))
        }

        console.log(chalk.green('\n🎉 SERVER CLONE COMPLETED! 🎉'))
        console.log(chalk.green(`✅ Successfully cloned "${sourceGuild.name}" to "${targetGuild.name}"`))
        console.log(chalk.cyan(`\n📊 Clone Summary:`))
        console.log(chalk.gray(`   🎭 Roles: ${rolesToClone.length} processed`))
        console.log(chalk.gray(`   📁 Categories: ${categories.length} processed`))
        console.log(chalk.gray(`   💬 Channels: ${regularChannels.length} processed`))
        
    } catch (error) {
        console.log(chalk.red(`\n❌ Clone failed: ${error.message}`))
        console.log(chalk.yellow('Check the logs for more details.'))
        await inquirer.prompt({ type: 'input', name: 'pause', message: 'Press Enter to return to menu...' })
    }
    await inquirer.prompt({ type: 'input', name: 'pause', message: 'Press Enter to return to menu...' })
}
