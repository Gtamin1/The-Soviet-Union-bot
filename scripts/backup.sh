#!/bin/bash

##############################################
# DATABASE BACKUP SCRIPT
# Automatically backs up PostgreSQL database
# Keeps last 7 days of backups
##############################################

# Configuration
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/home/user/backups"
DB_NAME="tsubot"
DB_USER="tsubot"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

echo "=========================================="
echo "Starting database backup..."
echo "Timestamp: $TIMESTAMP"
echo "=========================================="

# Create backup
pg_dump -U "$DB_USER" "$DB_NAME" > "$BACKUP_DIR/tsubot_$TIMESTAMP.sql"

if [ $? -eq 0 ]; then
    echo "✅ Backup completed successfully!"
    echo "📁 File: $BACKUP_DIR/tsubot_$TIMESTAMP.sql"

    # Get file size
    SIZE=$(du -h "$BACKUP_DIR/tsubot_$TIMESTAMP.sql" | cut -f1)
    echo "📊 Size: $SIZE"
else
    echo "❌ Backup failed!"
    exit 1
fi

# Delete backups older than 7 days
echo ""
echo "Cleaning up old backups (older than 7 days)..."
DELETED=$(find "$BACKUP_DIR" -name "*.sql" -mtime +7 -delete -print | wc -l)

if [ "$DELETED" -gt 0 ]; then
    echo "🗑️  Deleted $DELETED old backup(s)"
else
    echo "✅ No old backups to delete"
fi

echo ""
echo "=========================================="
echo "Current backups:"
echo "=========================================="
ls -lh "$BACKUP_DIR" | tail -n +2

echo ""
echo "✅ Backup process completed!"
