import inquirer from 'inquirer'
import chalk from 'chalk'
import figlet from 'figlet'
import gradient from 'gradient-string'
import fs from 'fs'
import path from 'path'
import { pathToFileURL } from 'url'
import dotenv from 'dotenv'
dotenv.config()

function clearTerminal() {
    process.stdout.write('\x1Bc')
}

function showBanner() {
    clearTerminal()
    const bannerText = `
 __      ____
 \\ \\    |  _ \\   _   _   ____   ___    _ __        ___    ___
  \\ \\   | |_) | | | | | |_  /  / _ \\  | '__|      / __|  / __|
  / /   |  _ <  | |_| |  / /  | (_) | | |     _  | (__  | (__
 /_/    |_| \\_\\  \\__, | /___|  \\___/  |_|    (_)  \\___|  \\___|
                 |___/  Github: @its3rr0rswrld / Discord: @wtf3rr0r`
    console.log(chalk.red(bannerText.split('@')[0]) + chalk.gray.dim('@its3rr0rswrld'))
    console.log("\n")
}

async function getConfig() {
    let token = process.env.DISCORD_TOKEN
    let debug = process.env.DEBUG_MODE === 'true'
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
    
    if (envContent.match(/DISCORD_TOKEN=/)) {
        envContent = envContent.replace(/DISCORD_TOKEN=.*/g, `DISCORD_TOKEN=${token}`)
    } else {
        envContent += `\nDISCORD_TOKEN=${token}`
    }
    
    if (envContent.match(/DEBUG_MODE=/)) {
        envContent = envContent.replace(/DEBUG_MODE=.*/g, `DEBUG_MODE=${debug}`)
    } else {
        envContent += `\nDEBUG_MODE=${debug}`
    }
    
    fs.writeFileSync('.env', envContent.trim() + '\n')
    return { token, debug }
}

async function saveConfig({ token, debug }) {
    let envContent = ''
    if (fs.existsSync('.env')) envContent = fs.readFileSync('.env', 'utf8')
    envContent = envContent.replace(/DISCORD_TOKEN=.*/g, '')
    envContent = envContent.replace(/DEBUG_MODE=.*/g, '')
    envContent += `\nDISCORD_TOKEN=${token}`
    envContent += `\nDEBUG_MODE=${debug}`
    fs.writeFileSync('.env', envContent.trim() + '\n')
}

async function loadTools() {
    const toolsDir = path.join(process.cwd(), 'tools')
    const toolFiles = fs.readdirSync(toolsDir).filter(file => file.endsWith('.js'))
    const tools = []
    for (const file of toolFiles) {
        try {
            const toolPath = pathToFileURL(path.join(toolsDir, file)).href
            const tool = await import(toolPath)
            tools.push({
                name: tool.name,
                description: tool.description,
                run: tool.run
            })
        } catch (error) {
            console.log(chalk.red(`Failed to load tool ${file}: ${error.message}`))
        }
    }
    return tools
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
        }
    }
}

async function mainMenu() {
    const config = await getConfig()
    const tools = await loadTools()
    const pastelRed = chalk.hex('#ff5555').bold
    const maxNameLength = tools.reduce((max, t) => Math.max(max, t.name.length), 0)
    const toolChoices = [
        ...tools.map(t => ({
            name: pastelRed(t.name.padEnd(maxNameLength + 2)) + chalk.gray.dim('>> ' + t.description),
            value: t.name
        })),
        { name: pastelRed('Settings'.padEnd(maxNameLength + 2)) + chalk.gray.dim('>> Open settings menu'), value: '__settings' },
        { name: pastelRed('Exit'.padEnd(maxNameLength + 2)) + chalk.gray.dim('>> Quit Ryzor.cc'), value: '__exit' }
    ]
    while (true) {
        showBanner()
        const { selected } = await inquirer.prompt([
            {
                type: 'list',
                name: 'selected',
                message: pastelRed('Select a tool:'),
                prefix: pastelRed('✔'),
                choices: toolChoices
            }
        ])
        if (selected === '__exit') {
            break
        }
        if (selected === '__settings') {
            await settingsMenu(config)
            continue
        }
        const tool = tools.find(t => t.name === selected)
        if (tool && tool.run) {
            await tool.run({ ...config, pastelRed })
        } else {
            console.log(pastelRed('Tool not found or missing run function.'))
        }
    }
}

mainMenu()
