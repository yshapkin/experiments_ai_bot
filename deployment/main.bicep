targetScope = 'resourceGroup'

@description('Application name used in resource names and tags.')
@minLength(1)
@maxLength(40)
param applicationName string = 'experiments-ai-bot'

@description('Deployment environment used in resource names and tags.')
@minLength(1)
@maxLength(20)
param environmentName string

@description('Azure region for the resources.')
param location string = resourceGroup().location

@description('Additional tags to apply to resources. Required tags take precedence.')
param tags object = {}

@description('Name of the Key Vault secret containing the Telegram bot token.')
@minLength(1)
@maxLength(127)
param telegramBotTokenSecretName string = 'telegram-bot-token'

@description('Name of the Key Vault secret containing the Telegram webhook secret.')
@minLength(1)
@maxLength(127)
param telegramWebhookSecretName string = 'telegram-webhook-secret'

var nameSuffix = take(uniqueString(resourceGroup().id, applicationName, environmentName), 6)
var applicationNameToken = take(toLower(replace(applicationName, '-', '')), 9)
var environmentNameToken = take(toLower(replace(environmentName, '-', '')), 4)
var resourceNameToken = '${applicationNameToken}-${environmentNameToken}-${nameSuffix}'
var resourceTags = union(tags, {
  application: applicationName
  environment: environmentName
  'managed-by': 'bicep'
})

var identityName = 'id-${resourceNameToken}'
var storageAccountName = 'st${applicationNameToken}${environmentNameToken}${nameSuffix}'
var servicePlanName = 'asp-${resourceNameToken}'
var functionAppName = 'func-${resourceNameToken}'
var keyVaultName = 'kv-${resourceNameToken}'
var logAnalyticsWorkspaceName = 'log-${resourceNameToken}'
var applicationInsightsName = 'appi-${resourceNameToken}'
var deploymentContainerName = 'function-releases'

var storageBlobDataOwnerRoleDefinitionId = subscriptionResourceId(
  'Microsoft.Authorization/roleDefinitions',
  'b7e6dc6d-f1e8-4753-8033-0f276bb0955b'
)
var keyVaultSecretsUserRoleDefinitionId = subscriptionResourceId(
  'Microsoft.Authorization/roleDefinitions',
  '4633458b-17de-408a-b874-0445c86b69e6'
)
var monitoringMetricsPublisherRoleDefinitionId = subscriptionResourceId(
  'Microsoft.Authorization/roleDefinitions',
  '3913510d-42f4-4e42-8a64-420c390055eb'
)

resource managedIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: identityName
  location: location
  tags: resourceTags
}

resource storageAccount 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: storageAccountName
  location: location
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  tags: resourceTags
  properties: {
    allowBlobPublicAccess: false
    allowSharedKeyAccess: false
    minimumTlsVersion: 'TLS1_2'
    publicNetworkAccess: 'Enabled'
    supportsHttpsTrafficOnly: true
  }
}

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = {
  parent: storageAccount
  name: 'default'
}

resource deploymentContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobService
  name: deploymentContainerName
  properties: {
    publicAccess: 'None'
  }
}

resource servicePlan 'Microsoft.Web/serverfarms@2024-04-01' = {
  name: servicePlanName
  location: location
  kind: 'functionapp'
  sku: {
    name: 'FC1'
    tier: 'FlexConsumption'
  }
  tags: resourceTags
  properties: {
    reserved: true
    zoneRedundant: false
  }
}

resource keyVault 'Microsoft.KeyVault/vaults@2024-11-01' = {
  name: keyVaultName
  location: location
  tags: resourceTags
  properties: {
    enablePurgeProtection: true
    enableRbacAuthorization: true
    enableSoftDelete: true
    publicNetworkAccess: 'Enabled'
    sku: {
      family: 'A'
      name: 'standard'
    }
    tenantId: tenant().tenantId
  }
}

resource logAnalyticsWorkspace 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: logAnalyticsWorkspaceName
  location: location
  tags: resourceTags
  properties: {
    retentionInDays: 30
    sku: {
      name: 'PerGB2018'
    }
  }
}

resource applicationInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: applicationInsightsName
  location: location
  kind: 'web'
  tags: resourceTags
  properties: {
    Application_Type: 'web'
    DisableLocalAuth: true
    IngestionMode: 'LogAnalytics'
    WorkspaceResourceId: logAnalyticsWorkspace.id
  }
}

resource storageBlobDataOwnerAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: storageAccount
  name: guid(storageAccount.id, managedIdentity.id, storageBlobDataOwnerRoleDefinitionId)
  properties: {
    principalId: managedIdentity.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: storageBlobDataOwnerRoleDefinitionId
  }
}

resource keyVaultSecretsUserAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: keyVault
  name: guid(keyVault.id, managedIdentity.id, keyVaultSecretsUserRoleDefinitionId)
  properties: {
    principalId: managedIdentity.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: keyVaultSecretsUserRoleDefinitionId
  }
}

resource monitoringMetricsPublisherAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: applicationInsights
  name: guid(applicationInsights.id, managedIdentity.id, monitoringMetricsPublisherRoleDefinitionId)
  properties: {
    principalId: managedIdentity.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: monitoringMetricsPublisherRoleDefinitionId
  }
}

resource functionApp 'Microsoft.Web/sites@2024-04-01' = {
  name: functionAppName
  location: location
  kind: 'functionapp,linux'
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${managedIdentity.id}': {}
    }
  }
  tags: resourceTags
  properties: {
    httpsOnly: true
    keyVaultReferenceIdentity: managedIdentity.id
    serverFarmId: servicePlan.id
    siteConfig: {
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
      appSettings: [
        {
          name: 'AzureWebJobsStorage__blobServiceUri'
          value: storageAccount.properties.primaryEndpoints.blob
        }
        {
          name: 'AzureWebJobsStorage__clientId'
          value: managedIdentity.properties.clientId
        }
        {
          name: 'AzureWebJobsStorage__credential'
          value: 'managedidentity'
        }
        {
          name: 'APPLICATIONINSIGHTS_AUTHENTICATION_STRING'
          value: 'ClientId=${managedIdentity.properties.clientId};Authorization=AAD'
        }
        {
          name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
          value: applicationInsights.properties.ConnectionString
        }
        {
          name: 'TELEGRAM_BOT_TOKEN'
          value: '@Microsoft.KeyVault(SecretUri=${keyVault.properties.vaultUri}secrets/${telegramBotTokenSecretName})'
        }
        {
          name: 'TELEGRAM_WEBHOOK_SECRET'
          value: '@Microsoft.KeyVault(SecretUri=${keyVault.properties.vaultUri}secrets/${telegramWebhookSecretName})'
        }
      ]
    }
    functionAppConfig: {
      deployment: {
        storage: {
          type: 'blobContainer'
          value: '${storageAccount.properties.primaryEndpoints.blob}${deploymentContainer.name}'
          authentication: {
            type: 'UserAssignedIdentity'
            userAssignedIdentityResourceId: managedIdentity.id
          }
        }
      }
      runtime: {
        name: 'node'
        version: '22'
      }
      scaleAndConcurrency: {
        instanceMemoryMB: 2048
        maximumInstanceCount: 10
      }
    }
  }
  dependsOn: [
    storageBlobDataOwnerAssignment
  ]
}

@description('Function App resource ID.')
output functionAppResourceId string = functionApp.id

@description('Function App name.')
output functionAppName string = functionApp.name

@description('Function App default hostname.')
output functionAppDefaultHostName string = functionApp.properties.defaultHostName

@description('Function App HTTPS base URL.')
output functionAppBaseUrl string = 'https://${functionApp.properties.defaultHostName}'

@description('Key Vault resource ID.')
output keyVaultResourceId string = keyVault.id

@description('Key Vault name.')
output keyVaultName string = keyVault.name

@description('Key Vault URI.')
output keyVaultUri string = keyVault.properties.vaultUri

@description('Storage account resource ID.')
output storageAccountResourceId string = storageAccount.id

@description('Storage account name.')
output storageAccountName string = storageAccount.name

@description('Application Insights resource ID.')
output applicationInsightsResourceId string = applicationInsights.id

@description('Application Insights name.')
output applicationInsightsName string = applicationInsights.name

@description('Log Analytics workspace resource ID.')
output logAnalyticsWorkspaceResourceId string = logAnalyticsWorkspace.id

@description('Log Analytics workspace name.')
output logAnalyticsWorkspaceName string = logAnalyticsWorkspace.name

@description('User-assigned managed identity client ID.')
output managedIdentityClientId string = managedIdentity.properties.clientId

@description('User-assigned managed identity principal ID.')
output managedIdentityPrincipalId string = managedIdentity.properties.principalId
