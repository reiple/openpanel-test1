#!/bin/sh
set -eu
clickhouse client --query 'CREATE DATABASE IF NOT EXISTS openpanel'
