variable "subscription_id" {
  description = "Azure Subscription ID"
  type        = string
}

variable "resource_group_name" {
  description = "Existing resource group name"
  type        = string
}

variable "location" {
  description = "Azure region"
  type        = string
}

variable "postgresql_server_name" {
  description = "Name of the Azure PostgreSQL Flexible Server"
  type        = string
}

variable "vm_name" {
  description = "Name of the Ubuntu VM"
  type        = string
}
