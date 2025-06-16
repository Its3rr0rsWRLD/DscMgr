import inquirer from 'inquirer'
import chalk from 'chalk'
import figlet from 'figlet'
import gradient from 'gradient-string'
import fs from 'fs'
import path from 'path'
import { pathToFileURL } from 'url'
import dotenv from 'dotenv'
import axios from 'axios'
import { HttpsProxyAgent } from 'https-proxy-agent'
dotenv.config()

function clearTerminal() {
    process.stdout.write('\x1Bc')
}

function showBanner() {
    clearTerminal()
    const bannerText = figlet.textSync('DSCMGR', { horizontalLayout: 'full' })
    console.log(gradient.pastel(bannerText))
    const bannerLines = bannerText.split('\n')
    const bannerWidth = Math.max(...bannerLines.map(line => line.length))
    const handle = '@its3rr0rswrld'
    const pad = Math.floor((bannerWidth - handle.length) / 2)
    const centeredHandle = ' '.repeat(Math.max(0, pad)) + handle
    console.log(chalk.gray(centeredHandle + '\n'))
}

async function getConfig() {
    let token = process.env.DISCORD_TOKEN
    let debug = process.env.DEBUG_MODE === 'true'
    let proxiesEnabled = process.env.PROXIES_ENABLED === 'true'
    let proxySource = process.env.PROXY_SOURCE || 'file'
    let proxyFile = process.env.PROXY_FILE || 'proxies.txt'
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
    if (!fs.existsSync('.env')) fs.writeFileSync('.env', '')
    let envContent = fs.readFileSync('.env', 'utf8')
    if (!envContent.match(/DISCORD_TOKEN=/)) envContent += `\nDISCORD_TOKEN=${token}`
    if (!envContent.match(/DEBUG_MODE=/)) envContent += `\nDEBUG_MODE=${debug}`
    if (!envContent.match(/PROXIES_ENABLED=/)) envContent += `\nPROXIES_ENABLED=${proxiesEnabled}`
    if (!envContent.match(/PROXY_SOURCE=/)) envContent += `\nPROXY_SOURCE=${proxySource}`
    if (!envContent.match(/PROXY_FILE=/)) envContent += `\nPROXY_FILE=${proxyFile}`
    fs.writeFileSync('.env', envContent.trim() + '\n')
    return { token, debug, proxiesEnabled, proxySource, proxyFile }
}

async function saveConfig({ token, debug, proxiesEnabled, proxySource, proxyFile }) {
    let envContent = ''
    if (fs.existsSync('.env')) envContent = fs.readFileSync('.env', 'utf8')
    envContent = envContent.replace(/DISCORD_TOKEN=.*/g, '')
    envContent = envContent.replace(/DEBUG_MODE=.*/g, '')
    envContent = envContent.replace(/PROXIES_ENABLED=.*/g, '')
    envContent = envContent.replace(/PROXY_SOURCE=.*/g, '')
    envContent = envContent.replace(/PROXY_FILE=.*/g, '')
    envContent += `\nDISCORD_TOKEN=${token}`
    envContent += `\nDEBUG_MODE=${debug}`
    if (proxiesEnabled !== undefined) envContent += `\nPROXIES_ENABLED=${proxiesEnabled}`
    if (proxySource) envContent += `\nPROXY_SOURCE=${proxySource}`
    if (proxyFile) envContent += `\nPROXY_FILE=${proxyFile}`
    fs.writeFileSync('.env', envContent.trim() + '\n')
}



async function loadTools() {
    const toolsDir = path.join(process.cwd(), 'tools')
    const toolFiles = fs.readdirSync(toolsDir).filter(f => f.endsWith('.js'))
    const tools = []
    for (const file of toolFiles) {
        const toolPath = path.join(toolsDir, file)
        const toolUrl = pathToFileURL(toolPath).href
        const tool = await import(toolUrl)
        tools.push({
            name: tool.name || file,
            description: tool.description || '',
            run: tool.run
        })
    }
    return tools
}

async function fetchProxiesFromProxyScrape() {
    try {
        const response = await axios.get('https://api.proxyscrape.com/v4/free-proxy-list/get?request=get_proxies&proxy_format=protocolipport&format=text')
        const proxies = response.data.split('\n').filter(p => p.trim())
        return proxies
    } catch (error) {
        console.log(chalk.red('Failed to fetch proxies from ProxyScrape:', error.message))
        return []
    }
}

async function loadProxies(config) {
    if (!config.proxiesEnabled) return []
    
    let proxies = []
    if (config.proxySource === 'proxyscrape') {
        console.log(chalk.yellow('Fetching proxies from ProxyScrape...'))
        proxies = await fetchProxiesFromProxyScrape()
        console.log(chalk.green(`Fetched ${proxies.length} proxies from ProxyScrape`))
    } else {
        try {
            if (fs.existsSync(config.proxyFile)) {
                const content = fs.readFileSync(config.proxyFile, 'utf8')
                proxies = content.split('\n').filter(p => p.trim())
                console.log(chalk.green(`Loaded ${proxies.length} proxies from ${config.proxyFile}`))
            } else {
                console.log(chalk.red(`Proxy file ${config.proxyFile} not found`))
            }
        } catch (error) {
            console.log(chalk.red('Failed to load proxy file:', error.message))
        }
    }
    return proxies
}

async function testProxy(proxy) {
    try {
        const agent = new HttpsProxyAgent(proxy.startsWith('http') ? proxy : `http://${proxy}`)
        const response = await axios.get('https://httpbin.org/ip', {
            httpsAgent: agent,
            timeout: 1500
        })
        return { proxy, working: true, ip: response.data.origin }
    } catch (error) {
        return { proxy, working: false, error: error.message }
    }
}

async function checkProxies(proxies) {
    console.log(chalk.yellow(`Testing ${proxies.length} proxies...`))
    const results = []
    const batchSize = 100
    
    for (let i = 0; i < proxies.length; i += batchSize) {
        const batch = proxies.slice(i, i + batchSize)
        const startTime = Date.now()
        
        const batchResults = await Promise.allSettled(batch.map(proxy => 
            Promise.race([
                testProxy(proxy),
                new Promise(resolve => setTimeout(() => resolve({ proxy, working: false, error: 'timeout' }), 1500))
            ])
        ))
        
        const resolvedResults = batchResults.map(result => 
            result.status === 'fulfilled' ? result.value : { proxy: 'unknown', working: false, error: 'failed' }
        )
        
        results.push(...resolvedResults)
        
        const working = resolvedResults.filter(r => r.working).length
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
        console.log(chalk.blue(`Tested ${Math.min(i + batchSize, proxies.length)}/${proxies.length} - ${working}/${batch.length} working in ${elapsed}s`))
    }
    
    const workingProxies = results.filter(r => r.working)
    console.log(chalk.green(`${workingProxies.length}/${proxies.length} proxies are working`))
    
    return results
}

function getRandomProxy(proxies) {
    if (!proxies || proxies.length === 0) return null
    return proxies[Math.floor(Math.random() * proxies.length)]
}

function createAxiosConfig(config, proxies = []) {
    const axiosConfig = {}
    
    if (config.proxiesEnabled && proxies.length > 0) {
        const proxy = getRandomProxy(proxies)
        if (proxy) {
            axiosConfig.httpsAgent = new HttpsProxyAgent(`http://${proxy}`)
            axiosConfig.httpAgent = new HttpsProxyAgent(`http://${proxy}`)
        }
    }
    
    return axiosConfig
}

async function proxiesMenu(config) {
    let proxiesEnabled = config.proxiesEnabled || false
    let proxySource = config.proxySource || 'file'
    let proxyFile = config.proxyFile || 'proxies.txt'
    while (true) {
        clearTerminal()
        showBanner()
        const { action } = await inquirer.prompt([
            {
                type: 'list',
                name: 'action',
                message: 'Proxies Settings:',
                choices: [
                    { name: `Proxies: ${proxiesEnabled ? 'ON' : 'OFF'}`, value: 'toggle' },
                    { name: `Proxy Source: ${proxySource === 'proxyscrape' ? 'ProxyScrape (auto)' : proxyFile}`, value: 'source' },
                    { name: 'Get & Check Proxies', value: 'check' },
                    { name: 'Back', value: 'back' }
                ],
                pageSize: 10,
                loop: false
            }
        ])
        if (action === 'back') break
        if (action === 'toggle') {
            proxiesEnabled = !proxiesEnabled
        } else if (action === 'check') {
            const proxies = await loadProxies({ ...config, proxiesEnabled: true, proxySource, proxyFile })
            if (proxies.length > 0) {
                const results = await checkProxies(proxies)
                const workingProxies = results.filter(r => r.working)
                
                if (workingProxies.length > 0) {
                    console.log(chalk.green('\nWorking proxies:'))
                    workingProxies.slice(0, 5).forEach(p => {
                        console.log(chalk.green(`  ${p.proxy} (${p.ip})`))
                    })
                    if (workingProxies.length > 5) {
                        console.log(chalk.gray(`  ... and ${workingProxies.length - 5} more`))
                    }
                    
                    const { save } = await inquirer.prompt([
                        {
                            type: 'confirm',
                            name: 'save',
                            message: `Save ${workingProxies.length} working proxies to proxies.txt?`,
                            default: true
                        }
                    ])
                    
                    if (save) {
                        const workingProxyList = workingProxies.map(p => p.proxy).join('\n')
                        fs.writeFileSync('proxies.txt', workingProxyList)
                        console.log(chalk.green('Saved working proxies to proxies.txt'))
                    }
                } else {
                    console.log(chalk.red('No working proxies found'))
                }
                
                await inquirer.prompt([{ type: 'input', name: 'continue', message: 'Press Enter to continue...' }])
            }
        } else if (action === 'source') {
            const { src } = await inquirer.prompt([
                {
                    type: 'list',
                    name: 'src',
                    message: 'Select proxy source:',
                    choices: [
                        { name: 'From file', value: 'file' },
                        { name: 'Get free proxies from ProxyScrape', value: 'proxyscrape' },
                        { name: 'Back', value: 'back' }
                    ]
                }
            ])
            if (src === 'back') continue
            if (src === 'file') {
                const { file } = await inquirer.prompt([
                    {
                        type: 'input',
                        name: 'file',
                        message: 'Enter proxy file path:',
                        default: proxyFile
                    }
                ])
                proxySource = 'file'
                proxyFile = file
            } else {
                proxySource = 'proxyscrape'
            }
        }
    }
    await saveConfig({ ...config, proxiesEnabled, proxySource, proxyFile })
}

async function settingsMenu(config) {
    let currentDebug = config.debug
    while (true) {
        clearTerminal()
        showBanner()
        const { action } = await inquirer.prompt([
            {
                type: 'list',
                name: 'action',
                message: 'Settings:',
                choices: [
                    { name: `Debug Mode: ${currentDebug ? 'ON' : 'OFF'}`, value: 'toggleDebug' },
                    { name: 'Proxies', value: 'proxies' },
                    { name: 'Back to main menu', value: 'back' }
                ],
                pageSize: 10,
                loop: false
            }
        ])
        if (action === 'back') break
        if (action === 'toggleDebug') {
            currentDebug = !currentDebug
            await saveConfig({ token: config.token, debug: currentDebug })
        } else if (action === 'proxies') {
            await proxiesMenu(config)
        }
    }
}



async function mainMenu() {
    const config = await getConfig()
    const tools = await loadTools()
    const proxies = await loadProxies(config)
    const menuChoices = [
        ...tools.map(t => ({ name: `${t.name} - ${t.description}`, value: t.name })),
        { name: 'Settings', value: '__settings' },
        { name: 'Exit', value: '__exit' }
    ]
    while (true) {
        showBanner()
        const { selected } = await inquirer.prompt([
            {
                type: 'list',
                name: 'selected',
                message: 'Select a tool:',
                choices: menuChoices
            }        ])
        if (selected === '__exit') {
            const { confirm } = await inquirer.prompt([
                {
                    type: 'confirm',
                    name: 'confirm',
                    message: 'Exit DSCMGR?',
                    default: false
                }
            ])
            if (confirm) break
            continue
        }
        if (selected === '__settings') {
            await settingsMenu(config)
            continue
        }        const tool = tools.find(t => t.name === selected)
        if (tool && tool.run) {
            await tool.run({ ...config, proxies, createAxiosConfig: () => createAxiosConfig(config, proxies) })
        } else {
            console.log(chalk.red('Tool not found or missing run function.'))
        }
    }
}

mainMenu()
