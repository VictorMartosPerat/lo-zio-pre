#!/bin/sh
# Fix react-i18next type augmentation that conflicts with Radix Slot
sed -i 's/children?: ReactI18NextChildren | Iterable<ReactI18NextChildren>;/children?: React.ReactNode;/' node_modules/react-i18next/index.d.ts 2>/dev/null || true
