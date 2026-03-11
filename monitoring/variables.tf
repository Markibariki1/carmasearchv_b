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

variable "valuation_image_tag" {
  description = "Docker image tag for the valuation API"
  type        = string
  default     = "v1.0"
}

variable "database_password" {
  description = "PostgreSQL database password"
  type        = string
  sensitive   = true
}
