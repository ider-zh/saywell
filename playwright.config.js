import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'tests/browser',timeout:process.env.CI?60000:30000,forbidOnly:Boolean(process.env.CI),fullyParallel:false,workers:1,reporter:process.env.CI?[['list'],['html',{open:'never'}]]:'list',use:{viewport:{width:1440,height:1000},trace:'retain-on-failure'},outputDir:'test-results'});
