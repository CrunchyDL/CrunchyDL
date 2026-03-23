const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

class ConfigService {
    constructor() {
        this.configDir = path.resolve(__dirname, '../multi-downloader-nx/config');
        this.cliDefaultsPath = path.join(this.configDir, 'cli-defaults.yml');
    }

    async getMuxingConfig() {
        try {
            if (!fs.existsSync(this.cliDefaultsPath)) {
                return {};
            }
            const fileContent = fs.readFileSync(this.cliDefaultsPath, 'utf8');
            return yaml.load(fileContent);
        } catch (error) {
            console.error('Error reading cli-defaults.yml:', error);
            return {};
        }
    }

    async updateMuxingConfig(newConfig) {
        try {
            const currentConfig = await this.getMuxingConfig();
            const updatedConfig = { ...currentConfig, ...newConfig };
            
            // Ensure config dir exists
            if (!fs.existsSync(this.configDir)) {
                fs.mkdirSync(this.configDir, { recursive: true });
            }

            const { tmdbApiKey, anilistToken, ...safeConfig } = updatedConfig;
            fs.writeFileSync(this.cliDefaultsPath, yaml.dump(safeConfig), 'utf8');
            return safeConfig;
        } catch (error) {
            console.error('Error updating cli-defaults.yml:', error);
            throw error;
        }
    }
}

module.exports = ConfigService;
