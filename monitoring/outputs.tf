output "workspace_name" {
  description = "Log Analytics Workspace name"
  value       = azurerm_log_analytics_workspace.monitoring.name
}

output "workspace_id" {
  description = "Log Analytics Workspace ID (use this to query logs)"
  value       = azurerm_log_analytics_workspace.monitoring.workspace_id
}

output "portal_logs_url" {
  description = "Direct link to view logs in Azure Portal"
  value       = "https://portal.azure.com/#blade/Microsoft_Azure_Monitoring_Logs/LogsBlade/resourceId/${urlencode(azurerm_log_analytics_workspace.monitoring.id)}"
}

output "valuation_api_url" {
  description = "CARMA Valuation API URL"
  value       = "https://${azurerm_container_app.valuation.ingress[0].fqdn}"
}
