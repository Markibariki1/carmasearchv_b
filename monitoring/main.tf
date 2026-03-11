# -------------------------------------------------------
# Reference existing resources (we don't create these)
# -------------------------------------------------------

data "azurerm_postgresql_flexible_server" "db" {
  name                = var.postgresql_server_name
  resource_group_name = var.resource_group_name
}

data "azurerm_virtual_machine" "vm" {
  name                = var.vm_name
  resource_group_name = var.resource_group_name
}

# -------------------------------------------------------
# Log Analytics Workspace — the central hub for all data
# Free tier: 5GB/month, 30-day retention
# -------------------------------------------------------

resource "azurerm_log_analytics_workspace" "monitoring" {
  name                = "carma-monitoring-workspace"
  location            = var.location
  resource_group_name = var.resource_group_name
  sku                 = "PerGB2018"
  retention_in_days   = 30
}

# -------------------------------------------------------
# PostgreSQL: send logs + metrics to the workspace
# -------------------------------------------------------

resource "azurerm_monitor_diagnostic_setting" "postgresql" {
  name                       = "carma-postgresql-diagnostics"
  target_resource_id         = data.azurerm_postgresql_flexible_server.db.id
  log_analytics_workspace_id = azurerm_log_analytics_workspace.monitoring.id

  enabled_log {
    category_group = "allLogs"
  }

  enabled_metric {
    category = "AllMetrics"
  }
}

# -------------------------------------------------------
# Ubuntu VM: install Azure Monitor Agent
# This agent ships data from the VM to Azure Monitor
# -------------------------------------------------------

resource "azurerm_virtual_machine_extension" "ama" {
  name                       = "AzureMonitorLinuxAgent"
  virtual_machine_id         = data.azurerm_virtual_machine.vm.id
  publisher                  = "Microsoft.Azure.Monitor"
  type                       = "AzureMonitorLinuxAgent"
  type_handler_version       = "1.0"
  auto_upgrade_minor_version = true
}

# -------------------------------------------------------
# Data Collection Rule — defines WHAT to collect from VM
# -------------------------------------------------------

resource "azurerm_monitor_data_collection_rule" "vm" {
  name                = "carma-vm-dcr"
  location            = var.location
  resource_group_name = var.resource_group_name

  destinations {
    log_analytics {
      workspace_resource_id = azurerm_log_analytics_workspace.monitoring.id
      name                  = "carma-workspace"
    }
  }

  data_flow {
    streams      = ["Microsoft-InsightsMetrics", "Microsoft-Syslog"]
    destinations = ["carma-workspace"]
  }

  data_sources {
    # CPU, memory, disk, network metrics — sampled every 60 seconds
    performance_counter {
      streams                       = ["Microsoft-InsightsMetrics"]
      sampling_frequency_in_seconds = 60
      counter_specifiers = [
        "Processor(*)\\% Processor Time",
        "Memory(*)\\% Available Memory",
        "Logical Disk(*)\\% Free Space",
        "Logical Disk(*)\\Disk Read Bytes/sec",
        "Logical Disk(*)\\Disk Write Bytes/sec",
        "Network(*)\\Total Bytes Received",
        "Network(*)\\Total Bytes Transmitted",
      ]
      name = "carma-perf-counters"
    }

    # System logs — warnings and above only
    syslog {
      streams        = ["Microsoft-Syslog"]
      facility_names = ["daemon", "syslog", "user", "kern"]
      log_levels     = ["Warning", "Error", "Critical", "Alert", "Emergency"]
      name           = "carma-syslog"
    }
  }

  depends_on = [azurerm_virtual_machine_extension.ama]
}

# -------------------------------------------------------
# Link the Data Collection Rule to the VM
# -------------------------------------------------------

resource "azurerm_monitor_data_collection_rule_association" "vm" {
  name                    = "carma-vm-dcr-association"
  target_resource_id      = data.azurerm_virtual_machine.vm.id
  data_collection_rule_id = azurerm_monitor_data_collection_rule.vm.id
}

# -------------------------------------------------------
# Valuation API — separate Container App
# -------------------------------------------------------

data "azurerm_container_app_environment" "env" {
  name                = "carma-environment"
  resource_group_name = var.resource_group_name
}

data "azurerm_container_registry" "acr" {
  name                = "carmaregistry"
  resource_group_name = var.resource_group_name
}

resource "azurerm_container_app" "valuation" {
  name                         = "carma-valuation-api"
  container_app_environment_id = data.azurerm_container_app_environment.env.id
  resource_group_name          = var.resource_group_name
  revision_mode                = "Single"

  identity {
    type = "SystemAssigned"
  }

  registry {
    server   = "${data.azurerm_container_registry.acr.name}.azurecr.io"
    identity = "System"
  }

  template {
    container {
      name   = "valuation-api"
      image  = "${data.azurerm_container_registry.acr.name}.azurecr.io/carma-valuation-api:${var.valuation_image_tag}"
      cpu    = 0.5
      memory = "1Gi"

      env {
        name  = "DATABASE_HOST"
        value = "carma.postgres.database.azure.com"
      }
      env {
        name  = "DATABASE_PORT"
        value = "5432"
      }
      env {
        name  = "DATABASE_USER"
        value = "carmaadmin"
      }
      env {
        name        = "DATABASE_PASSWORD"
        secret_name = "db-password"
      }
      env {
        name  = "DATABASE_NAME"
        value = "postgres"
      }
      env {
        name  = "DB_MIN_CONN"
        value = "1"
      }
      env {
        name  = "DB_MAX_CONN"
        value = "5"
      }
    }

    min_replicas = 0
    max_replicas = 2
  }

  secret {
    name  = "db-password"
    value = var.database_password
  }

  ingress {
    external_enabled = true
    target_port      = 8000
    transport        = "auto"

    traffic_weight {
      latest_revision = true
      percentage      = 100
    }
  }
}

resource "azurerm_role_assignment" "valuation_acr_pull" {
  scope                = data.azurerm_container_registry.acr.id
  role_definition_name = "AcrPull"
  principal_id         = azurerm_container_app.valuation.identity[0].principal_id
}
