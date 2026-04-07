'use client';

// ==========================================
// 1. IMPORTS & CONFIGURATION
// ==========================================
import { supabase } from '@/lib/supabase';
import { PROFORMA_SECTIONS } from '@/proforma_schema';
import React, { useState, useEffect, useRef } from 'react';
import Dexie, { type Table } from 'dexie';
import ExcelJS from 'exceljs';
// @ts-ignore
import { saveAs } from 'file-saver';
import { 
  Info, Database, Settings, PlusCircle, Trash2, 
  X, CheckSquare, Camera, ChevronRight, FileDown, 
  Filter, Search, Eye, Tag, Wifi, WifiOff, RefreshCcw, 
  Edit3, ArrowRight, AlertTriangle, Layers, MapPin, Loader2, PenTool, Grip, ArrowUp, ArrowDown, Plus, HardDrive
} from 'lucide-react';

// --- Offline Database Schema (Dexie) ---
class SeismicDB extends Dexie {
  outbox!: Table<{ id?: number; building_id: string; full_data: any; timestamp: number }>;
  constructor() {
    super('SeismicDB');
    this.version(1).stores({ outbox: '++id, building_id, timestamp' });
  }
}
const localDB = new SeismicDB();

// --- Types ---
type FieldType = 'text' | 'number' | 'select' | 'checkbox' | 'image' | 'gps' | 'group' | 'multi_select' | 'dynamic_series' | 'date';
type SubFieldType = 'text' | 'number' | 'select' | 'checkbox';

interface SubField {
  id: string;
  label: string;
  type: SubFieldType;
  options?: string[];
}

interface CustomField { 
  id: string; 
  label: string; 
  type: FieldType; 
  tooltip: string; 
  options?: string[]; 
  subFields?: SubField[]; 
  required?: boolean;
  allowComments?: boolean;
  autoDate?: boolean;
  dependsOn?: {
    fieldId: string;
    conditionType: 'equals' | 'notCaptured' | 'countGreaterThan' | 'isEmpty';
    triggerValues?: string[];
    triggerCount?: number;
  };
}

type UserRole = 'viewer' | 'collector' | 'editor' | 'admin';

interface Section {
  id: string;
  title: string;
  fields: CustomField[];
}

interface ImageObject { 
  url: string; 
  label: string; 
  isLocal?: boolean; 
}

interface DynamicSeriesItem {
    label: string;
    value: string;
}

interface BuildingReport { 
  id: string; 
  building_id: string; 
  created_at: string; 
  full_data: Record<string, any>; 
}

const DEFAULT_SECTIONS: Section[] = PROFORMA_SECTIONS as Section[];

type TypologyFieldType = 'text' | 'number' | 'select';

interface TypologyField {
  id: string;
  label: string;
  type: TypologyFieldType;
  options?: string[];
  displayWhen?: {
    fieldId: string;
    equals: string;
    equalsAny?: string[];
  };
}

interface TypologyDefinition {
  label: string;
  sheetName: string;
  fields: TypologyField[];
}

interface TypologyFieldGroup {
  id: string;
  label: string;
  fieldIds: string[];
  subLabels: Record<string, string>;
}

interface TypologySpecificData {
  selected_type: string;
  responses: Record<string, any>;
}

const FLOOR_OPTIONS = ['RC Slab', 'timber flat roof', 'T-iron roof', 'Not applicable', 'other'];
const ROOF_OPTIONS = ['RC Slab', 'timber flat roof', 'T-iron roof', 'wooden truss', 'steel truss', 'other'];
const FLOOR_CONNECTION_OPTIONS = ['No connection/bearing', 'connection through wooden laces', 'other'];
const ROOF_CONNECTION_OPTIONS = ['No connection/bearing', 'connection through wooden laces', 'steel anchor bolts', 'other'];

const TYPOLOGY_FIELD_GROUPS: TypologyFieldGroup[] = [
  {
    id: 'window_size_group',
    label: 'Typical size of window (ft)',
    fieldIds: ['window_size_length', 'window_size_height'],
    subLabels: {
      window_size_length: 'Width',
      window_size_height: 'Height'
    }
  },
  {
    id: 'door_size_group',
    label: 'Typical size of door (ft)',
    fieldIds: ['door_size_length', 'door_size_height'],
    subLabels: {
      door_size_length: 'Width',
      door_size_height: 'Height'
    }
  },
  {
    id: 'verandah_column_group',
    label: 'Verandah column size (in)',
    fieldIds: ['verandah_column_width', 'verandah_column_depth'],
    subLabels: {
      verandah_column_width: 'Width',
      verandah_column_depth: 'Depth'
    }
  },
  {
    id: 'block_size_group',
    label: 'Size of block (in)',
    fieldIds: ['size_of_block_width', 'size_of_block_depth', 'size_of_block_height'],
    subLabels: {
      size_of_block_width: 'Length',
      size_of_block_depth: 'Width',
      size_of_block_height: 'Height'
    }
  },
  {
    id: 'vertical_confining_group',
    label: 'Vertical confining element/column size (in)',
    fieldIds: ['vertical_confining_width', 'vertical_confining_depth'],
    subLabels: {
      vertical_confining_width: 'Width',
      vertical_confining_depth: 'Depth'
    }
  },
  {
    id: 'vertical_opening_group',
    label: 'Vertical confining elements at openings size (in)',
    fieldIds: ['vertical_opening_elements_width', 'vertical_opening_elements_depth'],
    subLabels: {
      vertical_opening_elements_width: 'Width',
      vertical_opening_elements_depth: 'Depth'
    }
  }
];

const TYPOLOGY_FIELD_GROUP_BY_ID: Record<string, TypologyFieldGroup> = TYPOLOGY_FIELD_GROUPS.reduce((acc, group) => {
  group.fieldIds.forEach(fieldId => {
    acc[fieldId] = group;
  });
  return acc;
}, {} as Record<string, TypologyFieldGroup>);

const TYPOLOGY_DEFINITIONS: TypologyDefinition[] = [
  {
    label: 'Unreinforced Stone Masonry',
    sheetName: 'UR Stone Masonry',
    fields: [
      { id: 'no_of_storey', label: 'No. of storey', type: 'select', options: ['single storey', 'double storey'] },
      { id: 'storey_height_ground', label: 'Storey height: Ground floor', type: 'number', displayWhen: { fieldId: 'no_of_storey', equals: 'single storey', equalsAny: ['single storey', 'double storey'] } },
      { id: 'storey_height_first', label: 'Storey height: First floor', type: 'number', displayWhen: { fieldId: 'no_of_storey', equals: 'double storey' } },
      { id: 'type_of_stone', label: 'Type of stone', type: 'select', options: ['Semi-dressed stone', 'round river-bed stone', 'foliated slate stone'] },
      { id: 'construction_material_availability', label: 'Construction material availability', type: 'select', options: ['Available', 'Not available'] },
      { id: 'construction_material_distance', label: 'Construction material distance(km)', type: 'number' },
      { id: 'maximum_stone_size', label: 'Maximum stone size', type: 'select', options: ['>12"', '9"-12"', '6"-9"', '<6"', 'other size'] },
      { id: 'maximum_stone_size_other', label: 'Maximum stone size (other)', type: 'number', displayWhen: { fieldId: 'maximum_stone_size', equals: 'other size' } },
      { id: 'type_of_mortar', label: 'Type of mortar', type: 'select', options: ['Dry/No mortar', 'Mud mortar', 'Cement-sand mortar'] },
      { id: 'through_stone_provision', label: 'Through stone', type: 'select', options: ['Provided', 'Not provided'] },
      { id: 'through_stone_spacing', label: 'Through stone typical spacing', type: 'number', displayWhen: { fieldId: 'through_stone_provision', equals: 'Provided' } },
      { id: 'orthogonal_wall_connection', label: 'Connection between orthogonal walls', type: 'select', options: ['through stone provided', 'not adequate connection'] },
      { id: 'external_wall_thickness_category', label: 'External Wall Thickness', type: 'select', options: ['<15"', '15"', '18"', '>18"', 'specific thickness'] },
      { id: 'external_wall_thickness_specific', label: 'External Wall Thickness - specific', type: 'number', displayWhen: { fieldId: 'external_wall_thickness_category', equals: 'specific thickness' } },
      { id: 'internal_wall_thickness_category', label: 'Internal Wall Thickness', type: 'select', options: ['<15"', '15"', '18"', '>18"', 'specific thickness'] },
      { id: 'internal_wall_thickness_specific', label: 'Internal Wall Thickness - specific', type: 'number', displayWhen: { fieldId: 'internal_wall_thickness_category', equals: 'specific thickness' } },
      { id: 'window_size_length', label: 'Typical size of window - Length (ft)', type: 'number' },
      { id: 'window_size_height', label: 'Typical size of window - Height (ft)', type: 'number' },
      { id: 'door_size_length', label: 'Typical size of door - Length (ft)', type: 'number' },
      { id: 'door_size_height', label: 'Typical size of door - Height (ft)', type: 'number' },
      { id: 'lintel_beam_type', label: 'Type of lintel beam', type: 'select', options: ['Continuous on all opening', 'separate on each opening'] },
      { id: 'opening_alignment_vertical', label: 'Opening alignment in vertical direction', type: 'select', options: ['Aligned', 'Not aligned'] },
      { id: 'lintel_beam_material', label: 'Material of lintel beam', type: 'select', options: ['wooden beam', 'stone beam', 'RC beam', 'other'] },
      { id: 'lintel_beam_material_other', label: 'Material of lintel beam - other', type: 'text', displayWhen: { fieldId: 'lintel_beam_material', equals: 'other' } },
      { id: 'verandah_column_type', label: 'Verandah column', type: 'select', options: ['RC column', 'Wooden column', 'Stone masonry column'] },
      { id: 'verandah_column_width', label: 'Verandah column size - Width (in)', type: 'number' },
      { id: 'verandah_column_depth', label: 'Verandah column size - Depth (in)', type: 'number' },
      { id: 'floor_type', label: 'Type of floor', type: 'select', options: FLOOR_OPTIONS },
      { id: 'floor_type_other', label: 'Type of floor - other', type: 'text', displayWhen: { fieldId: 'floor_type', equals: 'other' } },
      { id: 'floor_wall_connection', label: 'Connection of floor to wall', type: 'select', options: FLOOR_CONNECTION_OPTIONS },
      { id: 'floor_wall_connection_other', label: 'Connection of floor to wall - other', type: 'text', displayWhen: { fieldId: 'floor_wall_connection', equals: 'other' } },
      { id: 'roof_type', label: 'Type of roof', type: 'select', options: ROOF_OPTIONS },
      { id: 'roof_type_other', label: 'Type of roof - other', type: 'text', displayWhen: { fieldId: 'roof_type', equals: 'other' } },
      { id: 'roof_wall_connection', label: 'Connection of roof to wall', type: 'select', options: ROOF_CONNECTION_OPTIONS },
      { id: 'roof_wall_connection_other', label: 'Connection of roof to wall - other', type: 'text', displayWhen: { fieldId: 'roof_wall_connection', equals: 'other' } }
    ]
  },
  {
    label: 'Stone Masonry with Timber Laces',
    sheetName: 'Stone Masonry Timber',
    fields: [
      { id: 'no_of_storey', label: 'No. of storey', type: 'select', options: ['single storey', 'double storey'] },
      { id: 'storey_height_ground', label: 'Storey height: Ground floor', type: 'number', displayWhen: { fieldId: 'no_of_storey', equals: 'single storey', equalsAny: ['single storey', 'double storey'] } },
      { id: 'storey_height_first', label: 'Storey height: First floor', type: 'number', displayWhen: { fieldId: 'no_of_storey', equals: 'double storey' } },
      { id: 'type_of_stone', label: 'Type of stone', type: 'select', options: ['Semi-dressed stone', 'round river-bed stone', 'foliated slate stone'] },
      { id: 'construction_material_availability', label: 'Construction material availability', type: 'select', options: ['Available', 'Not available'] },
      { id: 'construction_material_distance', label: 'Construction material distance(km)', type: 'number' },
      { id: 'maximum_stone_size', label: 'Maximum stone size', type: 'select', options: ['>12"', '9"-12"', '6"-9"', '<6"', 'other size'] },
      { id: 'maximum_stone_size_other', label: 'Maximum stone size (other)', type: 'number', displayWhen: { fieldId: 'maximum_stone_size', equals: 'other size' } },
      { id: 'type_of_mortar', label: 'Type of mortar', type: 'select', options: ['Dry/No mortar', 'Mud mortar', 'Cement-sand mortar'] },
      { id: 'external_wall_thickness_category', label: 'External Wall Thickness', type: 'select', options: ['<15"', '15"', '18"', '>18"', 'specific thickness'] },
      { id: 'external_wall_thickness_specific', label: 'External Wall Thickness - specific', type: 'number', displayWhen: { fieldId: 'external_wall_thickness_category', equals: 'specific thickness' } },
      { id: 'internal_wall_thickness_category', label: 'Internal Wall Thickness', type: 'select', options: ['<15"', '15"', '18"', '>18"', 'specific thickness'] },
      { id: 'internal_wall_thickness_specific', label: 'Internal Wall Thickness - specific', type: 'number', displayWhen: { fieldId: 'internal_wall_thickness_category', equals: 'specific thickness' } },
      { id: 'spacing_between_timber_laces', label: 'Spacing Between Timber Laces (ft)', type: 'number' },
      { id: 'size_of_timber_laces', label: 'Size of timber laces', type: 'number' },
      { id: 'longitudinal_cross_connection', label: 'Connection between longitudinal timber laces and cross members', type: 'select', options: ['nailed', 'half connection'] },
      { id: 'spacing_of_cross_members', label: 'Spacing of cross members', type: 'number' },
      { id: 'corner_timber_connection', label: 'Connection between timber laces at wall corner', type: 'select', options: ['No connection', 'Nailed', 'Half connection with projection', 'half connection without projection'] },
      { id: 'window_size_length', label: 'Typical size of window - Length (ft)', type: 'number' },
      { id: 'window_size_height', label: 'Typical size of window - Height (ft)', type: 'number' },
      { id: 'door_size_length', label: 'Typical size of door - Length (ft)', type: 'number' },
      { id: 'door_size_height', label: 'Typical size of door - Height (ft)', type: 'number' },
      { id: 'opening_alignment_vertical', label: 'Opening alignment in vertical direction', type: 'select', options: ['Aligned', 'Not aligned'] },
      { id: 'verandah_column_type', label: 'Verandah column', type: 'select', options: ['RC column', 'Wooden column', 'Stone masonry column'] },
      { id: 'verandah_column_width', label: 'Verandah column size - Width (in)', type: 'number' },
      { id: 'verandah_column_depth', label: 'Verandah column size - Depth (in)', type: 'number' },
      { id: 'floor_type', label: 'Type of floor', type: 'select', options: FLOOR_OPTIONS },
      { id: 'floor_type_other', label: 'Type of floor - other', type: 'text', displayWhen: { fieldId: 'floor_type', equals: 'other' } },
      { id: 'floor_wall_connection', label: 'Connection of floor to wall', type: 'select', options: FLOOR_CONNECTION_OPTIONS },
      { id: 'floor_wall_connection_other', label: 'Connection of floor to wall - other', type: 'text', displayWhen: { fieldId: 'floor_wall_connection', equals: 'other' } },
      { id: 'roof_type', label: 'Type of roof', type: 'select', options: ROOF_OPTIONS },
      { id: 'roof_type_other', label: 'Type of roof - other', type: 'text', displayWhen: { fieldId: 'roof_type', equals: 'other' } },
      { id: 'roof_wall_connection', label: 'Connection of roof to wall', type: 'select', options: ROOF_CONNECTION_OPTIONS },
      { id: 'roof_wall_connection_other', label: 'Connection of roof to wall - other', type: 'text', displayWhen: { fieldId: 'roof_wall_connection', equals: 'other' } }
    ]
  },
  {
    label: 'RC Confined Stone Masonry',
    sheetName: 'RC Confined Stone',
    fields: [
      { id: 'no_of_storey', label: 'No. of storey', type: 'select', options: ['single storey', 'double storey'] },
      { id: 'storey_height_ground', label: 'Storey height: Ground floor', type: 'number', displayWhen: { fieldId: 'no_of_storey', equals: 'single storey', equalsAny: ['single storey', 'double storey'] } },
      { id: 'storey_height_first', label: 'Storey height: First floor', type: 'number', displayWhen: { fieldId: 'no_of_storey', equals: 'double storey' } },
      { id: 'type_of_stone', label: 'Type of stone', type: 'select', options: ['Semi-dressed quarry stone', 'round river-bed stone', 'foliated slate stone'] },
      { id: 'construction_material_availability', label: 'Construction material availability', type: 'select', options: ['Available', 'Not available'] },
      { id: 'construction_material_distance', label: 'Construction material distance(km)', type: 'number' },
      { id: 'maximum_stone_size', label: 'Maximum stone size', type: 'select', options: ['>12"', '9"-12"', '6"-9"', '<6"', 'other size'] },
      { id: 'maximum_stone_size_other', label: 'Maximum stone size (other)', type: 'number', displayWhen: { fieldId: 'maximum_stone_size', equals: 'other size' } },
      { id: 'type_of_mortar', label: 'Type of mortar', type: 'select', options: ['Dry/No mortar', 'Mud mortar', 'Cement-sand mortar'] },
      { id: 'through_stone_provision', label: 'Through stone', type: 'select', options: ['Provided', 'Not provided'] },
      { id: 'through_stone_spacing', label: 'Through stone typical spacing', type: 'number', displayWhen: { fieldId: 'through_stone_provision', equals: 'Provided' } },
      { id: 'external_wall_thickness_category', label: 'External Wall Thickness', type: 'select', options: ['<15"', '15"', '18"', '>18"', 'specific thickness'] },
      { id: 'external_wall_thickness_specific', label: 'External Wall Thickness - specific', type: 'number', displayWhen: { fieldId: 'external_wall_thickness_category', equals: 'specific thickness' } },
      { id: 'internal_wall_thickness_category', label: 'Internal Wall Thickness', type: 'select', options: ['<15"', '15"', '18"', '>18"', 'specific thickness'] },
      { id: 'internal_wall_thickness_specific', label: 'Internal Wall Thickness - specific', type: 'number', displayWhen: { fieldId: 'internal_wall_thickness_category', equals: 'specific thickness' } },
      { id: 'window_size_length', label: 'Typical size of window - Length (ft)', type: 'number' },
      { id: 'window_size_height', label: 'Typical size of window - Height (ft)', type: 'number' },
      { id: 'door_size_length', label: 'Typical size of door - Length (ft)', type: 'number' },
      { id: 'door_size_height', label: 'Typical size of door - Height (ft)', type: 'number' },
      { id: 'opening_alignment_vertical', label: 'Opening alignment in vertical direction', type: 'select', options: ['Aligned', 'Not aligned'] },
      { id: 'wall_column_connection', label: 'Connection between stone masonry wall and vertical confining column', type: 'select', options: ['Toothing provided', 'Not provided'] },
      { id: 'vertical_confining_width', label: 'Vertical confining element/column size - Width (in)', type: 'number' },
      { id: 'vertical_confining_depth', label: 'Vertical confining element/column size - Depth (in)', type: 'number' },
      { id: 'vertical_confining_location', label: 'Location of vertical confining element/column', type: 'select', options: ['At all corners only', 'At some corners', 'Intermediate elements are also provided'] },
      { id: 'vertical_confining_max_spacing', label: 'Maximum spacing of vertical confining elements', type: 'number' },
      { id: 'vertical_opening_elements', label: 'Vertical confining elements at openings', type: 'select', options: ['Provided', 'Not provided'] },
      { id: 'vertical_opening_elements_width', label: 'Vertical confining elements at openings size - Width (in)', type: 'number', displayWhen: { fieldId: 'vertical_opening_elements', equals: 'Provided' } },
      { id: 'vertical_opening_elements_depth', label: 'Vertical confining elements at openings size - Depth (in)', type: 'number', displayWhen: { fieldId: 'vertical_opening_elements', equals: 'Provided' } },
      { id: 'plinth_band', label: 'Horizontal Plinth bands/beams', type: 'select', options: ['Provided', 'Not provided'] },
      { id: 'plinth_band_size', label: 'Horizontal Plinth bands/beams - size', type: 'number', displayWhen: { fieldId: 'plinth_band', equals: 'Provided' } },
      { id: 'lintel_band', label: 'Horizontal Lintel bands/beams', type: 'select', options: ['Provided', 'Not provided'] },
      { id: 'lintel_band_size', label: 'Horizontal Lintel bands/beams - size', type: 'number', displayWhen: { fieldId: 'lintel_band', equals: 'Provided' } },
      { id: 'roof_floor_band', label: 'Horizontal Roof/floor bands/beams', type: 'select', options: ['Provided', 'Not provided'] },
      { id: 'roof_floor_band_size', label: 'Horizontal Roof/floor bands/beams - size', type: 'number', displayWhen: { fieldId: 'roof_floor_band', equals: 'Provided' } },
      { id: 'sill_band', label: 'Horizontal Sill bands/beams', type: 'select', options: ['Provided', 'Not provided'] },
      { id: 'sill_band_size', label: 'Horizontal Sill bands/beams - size', type: 'number', displayWhen: { fieldId: 'sill_band', equals: 'Provided' } },
      { id: 'verandah_column_type', label: 'Verandah column', type: 'select', options: ['RC column', 'Wooden column', 'Stone masonry column'] },
      { id: 'verandah_column_width', label: 'Verandah column size - Width (in)', type: 'number' },
      { id: 'verandah_column_depth', label: 'Verandah column size - Depth (in)', type: 'number' },
      { id: 'floor_type', label: 'Type of floor', type: 'select', options: FLOOR_OPTIONS },
      { id: 'floor_type_other', label: 'Type of floor - other', type: 'text', displayWhen: { fieldId: 'floor_type', equals: 'other' } },
      { id: 'floor_wall_connection', label: 'Connection of floor to wall', type: 'select', options: FLOOR_CONNECTION_OPTIONS },
      { id: 'floor_wall_connection_other', label: 'Connection of floor to wall - other', type: 'text', displayWhen: { fieldId: 'floor_wall_connection', equals: 'other' } },
      { id: 'roof_type', label: 'Type of roof', type: 'select', options: ROOF_OPTIONS },
      { id: 'roof_type_other', label: 'Type of roof - other', type: 'text', displayWhen: { fieldId: 'roof_type', equals: 'other' } },
      { id: 'roof_wall_connection', label: 'Connection of roof to wall', type: 'select', options: ROOF_CONNECTION_OPTIONS },
      { id: 'roof_wall_connection_other', label: 'Connection of roof to wall - other', type: 'text', displayWhen: { fieldId: 'roof_wall_connection', equals: 'other' } }
    ]
  },
  {
    label: 'Unreinforced Concrete/Adobe Block Masonry',
    sheetName: 'UR Block Adobe',
    fields: [
      { id: 'no_of_storey', label: 'No. of storey', type: 'select', options: ['single storey', 'double storey'] },
      { id: 'storey_height_ground', label: 'Storey height: Ground floor', type: 'number', displayWhen: { fieldId: 'no_of_storey', equals: 'single storey', equalsAny: ['single storey', 'double storey'] } },
      { id: 'storey_height_first', label: 'Storey height: First floor', type: 'number', displayWhen: { fieldId: 'no_of_storey', equals: 'double storey' } },
      { id: 'type_of_block', label: 'Type of block', type: 'select', options: ['Concrete solid block', 'Concrete hollow block', 'adobe solid block'] },
      { id: 'size_of_block_width', label: 'Size of block - Length (in)', type: 'number' },
      { id: 'size_of_block_depth', label: 'Size of block - Width (in)', type: 'number' },
      { id: 'size_of_block_height', label: 'Size of block - Height (in)', type: 'number' },
      { id: 'construction_material_availability', label: 'Construction material availability', type: 'select', options: ['Available', 'Not available'] },
      { id: 'construction_material_distance', label: 'Construction material distance(km)', type: 'number' },
      { id: 'type_of_mortar', label: 'Type of mortar', type: 'select', options: ['Mud mortar', 'Cement-sand mortar'] },
      { id: 'orthogonal_wall_connection', label: 'Connection between orthogonal walls', type: 'select', options: ['adequate with proper overlap', 'not adequate connection'] },
      { id: 'wall_thickness', label: 'Wall Thickness', type: 'number' },
      { id: 'window_size_length', label: 'Typical size of window - Length (ft)', type: 'number' },
      { id: 'window_size_height', label: 'Typical size of window - Height (ft)', type: 'number' },
      { id: 'door_size_length', label: 'Typical size of door - Length (ft)', type: 'number' },
      { id: 'door_size_height', label: 'Typical size of door - Height (ft)', type: 'number' },
      { id: 'lintel_beam_type', label: 'Type of lintel beam', type: 'select', options: ['Continuous on all opening', 'separate on each opening'] },
      { id: 'opening_alignment_vertical', label: 'Opening alignment in vertical direction', type: 'select', options: ['Aligned', 'Not aligned'] },
      { id: 'lintel_beam_material', label: 'Material of lintel beam', type: 'select', options: ['wooden beam', 'stone beam', 'RC beam', 'other'] },
      { id: 'lintel_beam_material_other', label: 'Material of lintel beam - other', type: 'text', displayWhen: { fieldId: 'lintel_beam_material', equals: 'other' } },
      { id: 'verandah_column_type', label: 'Verandah column', type: 'select', options: ['RC column', 'Wooden column', 'block masonry column'] },
      { id: 'verandah_column_width', label: 'Verandah column size - Width (in)', type: 'number' },
      { id: 'verandah_column_depth', label: 'Verandah column size - Depth (in)', type: 'number' },
      { id: 'floor_type', label: 'Type of floor', type: 'select', options: FLOOR_OPTIONS },
      { id: 'floor_type_other', label: 'Type of floor - other', type: 'text', displayWhen: { fieldId: 'floor_type', equals: 'other' } },
      { id: 'floor_wall_connection', label: 'Connection of floor to wall', type: 'select', options: FLOOR_CONNECTION_OPTIONS },
      { id: 'floor_wall_connection_other', label: 'Connection of floor to wall - other', type: 'text', displayWhen: { fieldId: 'floor_wall_connection', equals: 'other' } },
      { id: 'roof_type', label: 'Type of roof', type: 'select', options: ROOF_OPTIONS },
      { id: 'roof_type_other', label: 'Type of roof - other', type: 'text', displayWhen: { fieldId: 'roof_type', equals: 'other' } },
      { id: 'roof_wall_connection', label: 'Connection of roof to wall', type: 'select', options: ROOF_CONNECTION_OPTIONS },
      { id: 'roof_wall_connection_other', label: 'Connection of roof to wall - other', type: 'text', displayWhen: { fieldId: 'roof_wall_connection', equals: 'other' } }
    ]
  },
  {
    label: 'RC Confined Concrete Block/Adobe Masonry',
    sheetName: 'RC Confined Block Adobe',
    fields: [
      { id: 'no_of_storey', label: 'No. of storey', type: 'select', options: ['single storey', 'double storey'] },
      { id: 'storey_height_ground', label: 'Storey height: Ground floor', type: 'number', displayWhen: { fieldId: 'no_of_storey', equals: 'single storey', equalsAny: ['single storey', 'double storey'] } },
      { id: 'storey_height_first', label: 'Storey height: First floor', type: 'number', displayWhen: { fieldId: 'no_of_storey', equals: 'double storey' } },
      { id: 'type_of_block', label: 'Type of block', type: 'select', options: ['Concrete solid block', 'Concrete hollow block', 'adobe solid block'] },
      { id: 'size_of_block_width', label: 'Size of block - Length (in)', type: 'number' },
      { id: 'size_of_block_depth', label: 'Size of block - Width (in)', type: 'number' },
      { id: 'size_of_block_height', label: 'Size of block - Height (in)', type: 'number' },
      { id: 'construction_material_availability', label: 'Construction material availability', type: 'select', options: ['Available', 'Not available'] },
      { id: 'construction_material_distance', label: 'Construction material distance(km)', type: 'number' },
      { id: 'type_of_mortar', label: 'Type of mortar', type: 'select', options: ['Dry/No mortar', 'Mud mortar', 'Cement-sand mortar'] },
      { id: 'wall_thickness', label: 'Wall Thickness', type: 'number' },
      { id: 'window_size_length', label: 'Typical size of window - Length (ft)', type: 'number' },
      { id: 'window_size_height', label: 'Typical size of window - Height (ft)', type: 'number' },
      { id: 'door_size_length', label: 'Typical size of door - Length (ft)', type: 'number' },
      { id: 'door_size_height', label: 'Typical size of door - Height (ft)', type: 'number' },
      { id: 'opening_alignment_vertical', label: 'Opening alignment in vertical direction', type: 'select', options: ['Aligned', 'Not aligned'] },
      { id: 'wall_column_connection', label: 'Connection between block masonry wall and vertical confining column', type: 'select', options: ['Toothing provided', 'Not provided'] },
      { id: 'vertical_confining_width', label: 'Vertical confining element/column size - Width (in)', type: 'number' },
      { id: 'vertical_confining_depth', label: 'Vertical confining element/column size - Depth (in)', type: 'number' },
      { id: 'vertical_confining_location', label: 'Location of vertical confining element/column', type: 'select', options: ['At all corners only', 'At some corners', 'Intermediate elements are also provided'] },
      { id: 'vertical_confining_max_spacing', label: 'Maximum spacing of vertical confining elements', type: 'number' },
      { id: 'vertical_opening_elements', label: 'Vertical confining elements at openings', type: 'select', options: ['Provided', 'Not provided'] },
      { id: 'vertical_opening_elements_width', label: 'Vertical confining elements at openings size - Width (in)', type: 'number', displayWhen: { fieldId: 'vertical_opening_elements', equals: 'Provided' } },
      { id: 'vertical_opening_elements_depth', label: 'Vertical confining elements at openings size - Depth (in)', type: 'number', displayWhen: { fieldId: 'vertical_opening_elements', equals: 'Provided' } },
      { id: 'plinth_band', label: 'Horizontal Plinth bands/beams', type: 'select', options: ['Provided', 'Not provided'] },
      { id: 'plinth_band_size', label: 'Horizontal Plinth bands/beams - size', type: 'number', displayWhen: { fieldId: 'plinth_band', equals: 'Provided' } },
      { id: 'lintel_band', label: 'Horizontal Lintel bands/beams', type: 'select', options: ['Provided', 'Not provided'] },
      { id: 'lintel_band_size', label: 'Horizontal Lintel bands/beams - size', type: 'number', displayWhen: { fieldId: 'lintel_band', equals: 'Provided' } },
      { id: 'roof_floor_band', label: 'Horizontal Roof/floor bands/beams', type: 'select', options: ['Provided', 'Not provided'] },
      { id: 'roof_floor_band_size', label: 'Horizontal Roof/floor bands/beams - size', type: 'number', displayWhen: { fieldId: 'roof_floor_band', equals: 'Provided' } },
      { id: 'sill_band', label: 'Horizontal Sill bands/beams', type: 'select', options: ['Provided', 'Not provided'] },
      { id: 'sill_band_size', label: 'Horizontal Sill bands/beams - size', type: 'number', displayWhen: { fieldId: 'sill_band', equals: 'Provided' } },
      { id: 'verandah_column_type', label: 'Verandah column', type: 'select', options: ['RC column', 'Wooden column', 'block masonry column'] },
      { id: 'verandah_column_width', label: 'Verandah column size - Width (in)', type: 'number' },
      { id: 'verandah_column_depth', label: 'Verandah column size - Depth (in)', type: 'number' },
      { id: 'floor_type', label: 'Type of floor', type: 'select', options: FLOOR_OPTIONS },
      { id: 'floor_type_other', label: 'Type of floor - other', type: 'text', displayWhen: { fieldId: 'floor_type', equals: 'other' } },
      { id: 'floor_wall_connection', label: 'Connection of floor to wall', type: 'select', options: FLOOR_CONNECTION_OPTIONS },
      { id: 'floor_wall_connection_other', label: 'Connection of floor to wall - other', type: 'text', displayWhen: { fieldId: 'floor_wall_connection', equals: 'other' } },
      { id: 'roof_type', label: 'Type of roof', type: 'select', options: ROOF_OPTIONS },
      { id: 'roof_type_other', label: 'Type of roof - other', type: 'text', displayWhen: { fieldId: 'roof_type', equals: 'other' } },
      { id: 'roof_wall_connection', label: 'Connection of roof to wall', type: 'select', options: ROOF_CONNECTION_OPTIONS },
      { id: 'roof_wall_connection_other', label: 'Connection of roof to wall - other', type: 'text', displayWhen: { fieldId: 'roof_wall_connection', equals: 'other' } }
    ]
  }
];

const TYPOLOGY_DEFINITION_MAP: Record<string, TypologyDefinition> = TYPOLOGY_DEFINITIONS.reduce((acc, item) => {
  acc[item.label] = item;
  return acc;
}, {} as Record<string, TypologyDefinition>);

const emptyTypologyData = (): TypologySpecificData => ({ selected_type: '', responses: {} });

const parseTypologySpecificData = (raw: any): TypologySpecificData => {
  if (!raw) return emptyTypologyData();
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return {
        selected_type: typeof parsed?.selected_type === 'string' ? parsed.selected_type : '',
        responses: typeof parsed?.responses === 'object' && parsed?.responses ? parsed.responses : {}
      };
    } catch {
      return emptyTypologyData();
    }
  }
  if (typeof raw === 'object') {
    return {
      selected_type: typeof raw?.selected_type === 'string' ? raw.selected_type : '',
      responses: typeof raw?.responses === 'object' && raw?.responses ? raw.responses : {}
    };
  }
  return emptyTypologyData();
};

// ==========================================
// 2. SUB-COMPONENTS
// ==========================================

const Tooltip = ({ text }: { text: string }) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <span className="relative ml-2 inline-flex items-center z-10">
      <button type="button" onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
        className={`w-5 h-5 md:w-6 md:h-6 rounded-full flex items-center justify-center transition-all shadow-sm ${isOpen ? 'bg-[#FFDC00] text-[#111111] ring-2 ring-[#111111]' : 'bg-[#AAAAAA] text-[#111111] hover:bg-[#FFDC00]'}`}>
        <Info size={12} strokeWidth={3} />
      </button>
      {isOpen && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-48 md:w-64 p-3 md:p-4 bg-[#FFDC00] text-[#111111] rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.5)] text-xs font-bold leading-relaxed border-2 border-[#111111] animate-in fade-in zoom-in-95">
          <p className="border-b-2 border-[#111111]/20 pb-1 mb-1 uppercase font-black text-[9px] tracking-widest">Guidance</p>
          {text}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-[#FFDC00]" />
        </div>
      )}
    </span>
  );
};

const ImageUpload = ({ label, value, onChange }: { label: string, value: ImageObject[], onChange: (imgs: ImageObject[]) => void }) => {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setUploading(true);
    const newItems = [...value];

    // Process all files with Promise.all to wait for all uploads
    const uploadPromises = files.map(async (file) => {
      if (navigator.onLine) {
        const formData = new FormData();
        formData.append('file', file);
        try {
          console.log('Starting R2 upload for:', file.name);
          const res = await fetch('/api/upload', { method: 'POST', body: formData });
          if (!res.ok) {
            const error = await res.text();
            console.error('Upload API error:', res.status, error);
            throw new Error(`API Error: ${res.status}`);
          }
          const data = await res.json();
          console.log('R2 upload successful, URL:', data.url);
          newItems.push({ url: data.url, label: `Capture ${newItems.length + 1}`, isLocal: false });
        } catch (err) {
          console.error('R2 upload failed, saving locally:', err);
          await saveLocally(file, newItems);
        }
      } else {
        console.log('Offline, saving locally:', file.name);
        await saveLocally(file, newItems);
      }
    });

    // Wait for all uploads to complete before updating state
    await Promise.all(uploadPromises);
    onChange(newItems);
    setUploading(false);
  };

  const saveLocally = (file: File, items: ImageObject[]): Promise<void> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
          if (reader.result) {
              items.push({ url: reader.result as string, label: `Offline Img ${items.length + 1}`, isLocal: true });
              resolve();
          } else {
              resolve();
          }
      };
      reader.onerror = () => {
          console.error('FileReader error:', reader.error);
          resolve();
      };
      reader.readAsDataURL(file);
    });
  };

  const updateLabel = (index: number, newText: string) => {
    const updated = [...value]; updated[index].label = newText; onChange(updated);
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-2">
        {value.map((img, i) => (
          <div key={i} className={`flex gap-3 p-2 rounded-lg border items-center ${img.isLocal ? 'bg-orange-50 border-orange-300' : 'bg-[#DDDDDD] border-[#AAAAAA]'}`}>
            <div className="w-16 h-16 rounded-md overflow-hidden border border-[#111111] flex-shrink-0 relative">
              <img src={img.url} className="w-full h-full object-cover" alt="" />
              {img.isLocal && <div className="absolute bottom-0 inset-x-0 bg-orange-600 text-white text-[8px] font-bold text-center">LOCAL</div>}
            </div>
            <div className="flex-1 min-w-0">
              <input type="text" value={img.label} onChange={(e) => updateLabel(i, e.target.value)} 
                className="w-full bg-[#FFFFFF] p-2 rounded border border-[#AAAAAA] text-[#111111] text-xs font-bold outline-none focus:border-[#85144B]" placeholder="Label..." />
            </div>
            <button onClick={() => onChange(value.filter((_, idx) => idx !== i))} className="text-red-500 p-2 hover:bg-red-50 rounded-full"><Trash2 size={16} /></button>
          </div>
        ))}
      </div>
      <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading}
        className={`w-full py-4 md:py-6 border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-1 transition-all ${uploading ? 'bg-slate-50 border-blue-400' : 'bg-[#FFFFFF] border-[#AAAAAA] hover:bg-slate-50 hover:border-[#85144B]'}`}>
        <Camera size={20} className={uploading ? 'animate-pulse text-blue-600' : 'text-[#111111]'} />
        <span className="text-[10px] md:text-xs font-black uppercase tracking-widest text-[#111111]">{uploading ? 'Processing...' : 'Add Photos'}</span>
        <input type="file" multiple accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageChange} />
      </button>
    </div>
  );
};

const MultiSelect = ({ options, value, onChange }: { options: string[], value: string[], onChange: (val: string[]) => void }) => {
    const toggle = (opt: string) => {
        if (value.includes(opt)) onChange(value.filter(v => v !== opt));
        else onChange([...value, opt]);
    };
    return (
        <div className="grid grid-cols-2 gap-2">
            {options.map(opt => (
                <button key={opt} onClick={() => toggle(opt)} 
                    className={`p-3 text-left rounded-lg text-xs font-bold border-2 transition-all flex items-center justify-between ${value.includes(opt) ? 'bg-[#001F3F] text-white border-[#001F3F]' : 'bg-white text-black border-[#AAAAAA]'}`}>
                    {opt}
                    {value.includes(opt) && <CheckSquare size={14} className="text-[#39CCCC]" />}
                </button>
            ))}
        </div>
    );
};

const DynamicSeries = ({ value, onChange, darkModeProp = false }: { value: DynamicSeriesItem[], onChange: (val: DynamicSeriesItem[]) => void, darkModeProp?: boolean }) => {
    const addRow = () => {
        const nextIdx = value.length + 1;
        onChange([...value, { label: `Label ${nextIdx}`, value: '' }]);
    };
    
    const updateRow = (index: number, field: 'label' | 'value', val: string) => {
        const updated = [...value];
        updated[index] = { ...updated[index], [field]: val };
        onChange(updated);
    };

    const dm = darkModeProp;
    return (
      <div className="space-y-2">
        {value.map((item, idx) => (
          <div key={idx} className="flex gap-2">
            <input type="text" className={`w-1/2 p-2 rounded border font-bold text-xs ${dm ? 'bg-slate-700 text-white border-slate-600 placeholder:text-slate-300' : 'bg-[#F5F5F5] text-black border-[#CCCCCC] placeholder:text-slate-500'}`} 
              value={item.label} onChange={(e) => updateRow(idx, 'label', e.target.value)} placeholder="Label" />
            <input type="number" className={`w-1/2 p-2 rounded border font-bold text-xs ${dm ? 'bg-slate-800 text-white border-slate-600 placeholder:text-slate-300' : 'bg-white text-black border-[#AAAAAA] placeholder:text-slate-500'}`} 
              value={item.value} onChange={(e) => updateRow(idx, 'value', e.target.value)} placeholder="Value" />
            <button onClick={() => onChange(value.filter((_, i) => i !== idx))} className="text-red-500"><Trash2 size={16}/></button>
          </div>
        ))}
        <button onClick={addRow} className="w-full py-2 bg-[#DDDDDD] rounded-lg text-xs font-black text-[#111111] hover:bg-[#CCCCCC] flex items-center justify-center gap-2">
          <Plus size={14} /> ADD ROW
        </button>
      </div>
    );
};

// ==========================================
// 3. MAIN COMPONENT LOGIC
// ==========================================
export default function BuildingForm() {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [locating, setLocating] = useState(false);
  
  // NEW: State for Offline Installation Prompt
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [password, setPassword] = useState('');

  const [sections, setSections] = useState<Section[]>([]);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [reports, setReports] = useState<BuildingReport[]>([]);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [editingReport, setEditingReport] = useState<BuildingReport | null>(null);
  const [viewingImages, setViewingImages] = useState<ImageObject[] | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 8;

  const [newSectionTitle, setNewSectionTitle] = useState('');
  const [targetSectionId, setTargetSectionId] = useState('');
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [newFieldType, setNewFieldType] = useState<FieldType>('text');
  const [newFieldTooltip, setNewFieldTooltip] = useState('');
  const [newFieldAllowComments, setNewFieldAllowComments] = useState(false);
  const [newFieldAutoDate, setNewFieldAutoDate] = useState(false);
  const [newOptions, setNewOptions] = useState<string[]>(['']);
  
  const [tempSubFields, setTempSubFields] = useState<SubField[]>([]);
  const [newSubLabel, setNewSubLabel] = useState('');
  const [newSubType, setNewSubType] = useState<SubFieldType>('text');
  const [newSubOptions, setNewSubOptions] = useState<string[]>([]);

  const [dependsOnFieldId, setDependsOnFieldId] = useState('');
  const [dependsOnTriggerValues, setDependsOnTriggerValues] = useState<string[]>([]);

  const [dependsOnConditionType, setDependsOnConditionType] = useState<'equals' | 'notCaptured' | 'countGreaterThan' | 'isEmpty'>('equals');
  const [dependsOnTriggerCount, setDependsOnTriggerCount] = useState<number>(0);
  const [previewMode, setPreviewMode] = useState(false);
  const [userRole, setUserRole] = useState<UserRole>('admin');
  const [showExportImport, setShowExportImport] = useState(false);
  const [adminTab, setAdminTab] = useState<'schema' | 'logic' | 'preview' | 'access'>('schema');
  const [draggedFieldId, setDraggedFieldId] = useState<string | null>(null);
  const [surveyTab, setSurveyTab] = useState<'general' | 'typology'>('general');

  // NEW: Autosave, Dark Mode, Filters, Audit Log
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'complete' | 'incomplete'>('all');
  const [auditLog, setAuditLog] = useState<Array<{id: string; fieldLabel: string; oldValue: any; newValue: any; timestamp: Date; userId: string}>>([]);
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [batchSelectedReports, setBatchSelectedReports] = useState<Set<string>>(new Set());
  const [showQualityIndicator, setShowQualityIndicator] = useState(true);

  // NEW: Surveyor tracking and timing
  const [surveyorName, setSurveyorName] = useState('');
  const [showSurveyorModal, setShowSurveyorModal] = useState(false);
  const [tempSurveyorName, setTempSurveyorName] = useState('');
  const [surveyStartTime, setSurveyStartTime] = useState<number | null>(null);

  // Field editing state
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [editingFieldSectionId, setEditingFieldSectionId] = useState<string | null>(null);
  const [editFieldType, setEditFieldType] = useState<FieldType>('text');
  const [editFieldOptions, setEditFieldOptions] = useState<string[]>([]);
  const [editingFieldNewLabel, setEditingFieldNewLabel] = useState('');
  const [fieldSaveStatus, setFieldSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  // UI Enhancement state variables
  const [fieldSearchQuery, setFieldSearchQuery] = useState('');
  const [bulkSelectedFields, setBulkSelectedFields] = useState<Set<string>>(new Set());
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [editingFieldSectionIndex, setEditingFieldSectionIndex] = useState<number | null>(null);
  
  // NEW: Conditional Logic Features
  const [showConditionalTestMode, setShowConditionalTestMode] = useState(false);
  const [testPreviewData, setTestPreviewData] = useState<Record<string, any>>({});
  const [circularDependencyWarnings, setCircularDependencyWarnings] = useState<string[]>([]);


  // ========== HELPER FUNCTIONS FOR UI ENHANCEMENTS ==========
  const getFieldTypeColor = (type: FieldType): string => {
    const colors: Record<FieldType, string> = {
      text: 'bg-blue-50 border-blue-200',
      date: 'bg-cyan-50 border-cyan-200',
      number: 'bg-purple-50 border-purple-200',
      select: 'bg-green-50 border-green-200',
      multi_select: 'bg-emerald-50 border-emerald-200',
      checkbox: 'bg-yellow-50 border-yellow-200',
      image: 'bg-orange-50 border-orange-200',
      gps: 'bg-pink-50 border-pink-200',
      group: 'bg-indigo-50 border-indigo-200',
      dynamic_series: 'bg-cyan-50 border-cyan-200'
    };
    return colors[type];
  };

  const getFieldTypeIcon = (type: FieldType): string => {
    const icons: Record<FieldType, string> = {
      text: '📝',
      date: '📅',
      number: '🔢',
      select: '📋',
      multi_select: '☑️',
      checkbox: '✓',
      image: '📷',
      gps: '📍',
      group: '📦',
      dynamic_series: '📊'
    };
    return icons[type];
  };

  const getFieldTypeLabel = (type: FieldType): string => {
    const labels: Record<FieldType, string> = {
      text: 'Text',
      number: 'Number',
      select: 'Dropdown',
      multi_select: 'Multi-Select',
      checkbox: 'Checkbox',
      image: 'Photo',
      gps: 'GPS',
      group: 'Group',
      dynamic_series: 'Dynamic Series',
      date: 'Date'
    };
    return labels[type];
  };

  const getTypologyDataFromSource = (source: Record<string, any>): TypologySpecificData => {
    return parseTypologySpecificData(source?.typology_specific_data);
  };

  const getCurrentTypologyData = (): TypologySpecificData => {
    return getTypologyDataFromSource(formData);
  };

  const updateTypologySelectedType = (selectedType: string) => {
    setFormData(prev => {
      const current = getTypologyDataFromSource(prev);
      const next: TypologySpecificData = {
        selected_type: selectedType,
        responses: selectedType === current.selected_type ? current.responses : {}
      };
      return { ...prev, typology_specific_data: next };
    });
  };

  const updateTypologyResponse = (fieldId: string, value: any) => {
    setFormData(prev => {
      const current = getTypologyDataFromSource(prev);
      const next: TypologySpecificData = {
        selected_type: current.selected_type,
        responses: {
          ...current.responses,
          [fieldId]: value
        }
      };
      return { ...prev, typology_specific_data: next };
    });
  };

  const isTypologyFieldVisible = (field: TypologyField, responses: Record<string, any>): boolean => {
    if (!field.displayWhen) return true;
    const parentValue = responses?.[field.displayWhen.fieldId];
    if (field.displayWhen.equalsAny && field.displayWhen.equalsAny.length > 0) {
      return field.displayWhen.equalsAny.includes(parentValue);
    }
    return parentValue === field.displayWhen.equals;
  };

  const countFieldUsage = (fieldId: string): number => {
    let count = 0;
    reports.forEach(report => {
      const field = sections.flatMap(s => s.fields).find(f => f.id === fieldId);
      if (field && report.full_data[field.label] !== undefined && report.full_data[field.label] !== '' && report.full_data[field.label] !== null) {
        count++;
      }
    });
    return count;
  };

  const getFieldsInSection = (sectionId: string): CustomField[] => {
    const section = sections.find(s => s.id === sectionId);
    return section ? section.fields : [];
  };

  const quickAddField = async (type: FieldType, baseLabel: string) => {
    if (!targetSectionId) {
      alert('Please select a section first');
      return;
    }
    const newFieldId = Date.now().toString();
    const newField: CustomField = {
      id: newFieldId,
      label: baseLabel,
      type,
      tooltip: 'Observation required.',
      required: false,
      allowComments: false,
      options: (type === 'select' || type === 'multi_select') ? ['Option 1', 'Option 2'] : undefined
    };
    const updatedSections = sections.map(sec => 
      sec.id === targetSectionId ? { ...sec, fields: [...sec.fields, newField] } : sec
    );
    await updateSchema(updatedSections);
  };

  const bulkUpdateFieldType = async (newType: FieldType) => {
    if (bulkSelectedFields.size === 0) return;
    const updatedSections = sections.map(section => ({
      ...section,
      fields: section.fields.map(field => {
        if (bulkSelectedFields.has(field.id)) {
          return {
            ...field,
            type: newType,
            options: (newType === 'select' || newType === 'multi_select') ? field.options || [] : undefined
          };
        }
        return field;
      })
    }));
    await updateSchema(updatedSections);
    setBulkSelectedFields(new Set());
    alert(`✅ Updated ${bulkSelectedFields.size} fields to ${getFieldTypeLabel(newType)}`);
  };

  const bulkToggleRequired = async () => {
    if (bulkSelectedFields.size === 0) return;
    const updatedSections = sections.map(section => ({
      ...section,
      fields: section.fields.map(field => {
        if (bulkSelectedFields.has(field.id)) {
          return { ...field, required: !field.required };
        }
        return field;
      })
    }));
    await updateSchema(updatedSections);
    setBulkSelectedFields(new Set());
    alert(`✅ Toggled required status for ${bulkSelectedFields.size} fields`);
  };

  const checkPending = async () => {
    if (localDB && localDB.outbox) {
      setPendingCount(await localDB.outbox.count());
    }
  };

  const loadSchema = async () => { 
    try {
      const { data } = await supabase.from('survey_schema').select('fields').limit(1).single(); 
      if(data && data.fields) { 
        setSections(data.fields); 
        if (data.fields.length > 0) setTargetSectionId(data.fields[0].id); 
      } else { 
        setSections(DEFAULT_SECTIONS); 
        setTargetSectionId(DEFAULT_SECTIONS[0].id); 
      }
    } catch (error) {
      setSections(DEFAULT_SECTIONS);
    }
  };

  const loadReports = async () => { 
    try {
      const { data } = await supabase.from('building_reports').select('*').order('created_at', {ascending: false}); 
      if(data) setReports(data); 
    } catch (error) {
      console.error("Archive sync failed");
    }
  };

  useEffect(() => {
    loadSchema();
    loadReports();
    checkPending();
  
    const update = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', update); 
    window.addEventListener('offline', update);
  
    // NEW: Capture Install Prompt Event
    const handlePrompt = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handlePrompt);
    
    // NEW: Detect circular dependencies on mount
    detectCircularDependencies();
  
    return () => { 
      window.removeEventListener('online', update); 
      window.removeEventListener('offline', update);
      window.removeEventListener('beforeinstallprompt', handlePrompt);
    };
  }, []); 

  // NEW: Trigger Function for Offline Download
  const handleOfflineInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') setInstallPrompt(null);
  };

  // NEW: Real-time Autosave Effect (save immediately on any change)
  useEffect(() => {
    if (Object.keys(formData).length === 0) return;
    // Save draft immediately on any change
    localStorage.setItem('formDataDraft', JSON.stringify(formData));
    setLastSaved(new Date());
  }, [formData]);

  // NEW: Page unload handler to save draft before leaving
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (Object.keys(formData).length > 0 && unsavedChanges) {
        localStorage.setItem('formDataDraft', JSON.stringify(formData));
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [formData, unsavedChanges]);

  // NEW: Load autosaved draft on mount
  useEffect(() => {
    const savedDraft = localStorage.getItem('formDataDraft');
    if (savedDraft) {
      try {
        setFormData(JSON.parse(savedDraft));
      } catch (e) {
        console.error('Failed to load draft');
      }
    }

    // Load surveyor name and show modal if not set
    const savedSurveyorName = localStorage.getItem('surveyorName');
    if (savedSurveyorName) {
      setSurveyorName(savedSurveyorName);
    } else {
      setShowSurveyorModal(true);
    }
  }, []);

  // NEW: Track form data changes to mark as unsaved
  useEffect(() => {
    if (Object.keys(formData).length > 0) {
      setUnsavedChanges(true);
    }
  }, [formData]);

  // NEW: Auto-populate Building ID and Surveyor Name when surveyor name is set
  useEffect(() => {
    if (!surveyorName) return;
    
    // Only auto-populate if form is empty (new survey) or doesn't have Building ID yet
    if (!formData['Building ID']) {
      const nextBuildingId = getNextBuildingId(surveyorName);
      const startTime = Date.now();
      
      setFormData(prev => ({
        ...prev,
        'Surveyor Name': surveyorName,
        'Building ID': nextBuildingId,
        '__startTime': startTime,
      }));
      setSurveyStartTime(startTime);
    }
  }, [surveyorName]);

  // NEW: Dark mode effect
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('darkMode', 'true');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('darkMode', 'false');
    }
  }, [darkMode]);

  // NEW: Load dark mode preference
  useEffect(() => {
    const savedDarkMode = localStorage.getItem('darkMode') === 'true';
    setDarkMode(savedDarkMode);
  }, []);

  // NEW: Re-check circular dependencies when schema changes
  useEffect(() => {
    detectCircularDependencies();
  }, [sections]);

  // NEW: Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 's') {
          e.preventDefault();
          submitReport();
        }
        if (e.key === 'k') {
          e.preventDefault();
          setSearchQuery('');
        }
      }
      if (e.key === 'Escape') {
        setEditingReport(null);
        setViewingImages(null);
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [formData]);

  // NEW: Check if a field's dependency condition is satisfied
  const isConditionSatisfied = (field: CustomField, dataSource: Record<string, any> = formData): boolean => {
    if (!field.dependsOn) return true;
    const parentField = sections.flatMap(s => s.fields).find(f => f.id === field.dependsOn?.fieldId);
    if (!parentField) return true;
    const parentValue = dataSource[parentField.label];
    
    switch (field.dependsOn.conditionType) {
      case 'equals':
        return field.dependsOn.triggerValues ? field.dependsOn.triggerValues.includes(String(parentValue)) : false;
      case 'notCaptured':
        return !parentValue || (Array.isArray(parentValue) && parentValue.length === 0);
      case 'isEmpty':
        return !parentValue || String(parentValue).trim() === '';
      case 'countGreaterThan':
        if (Array.isArray(parentValue)) return parentValue.length > (field.dependsOn.triggerCount || 0);
        return false;
      default:
        return true;
    }
  };

  // NEW: Get human-readable description of a field's condition
  const getConditionDescription = (field: CustomField): string => {
    if (!field.dependsOn) return '';
    const parentField = sections.flatMap(s => s.fields).find(f => f.id === field.dependsOn?.fieldId);
    if (!parentField) return '';
    
    switch (field.dependsOn.conditionType) {
      case 'equals':
        const values = field.dependsOn.triggerValues?.join(' or ') || 'unknown';
        return `appears when "${parentField.label}" is "${values}"`;
      case 'notCaptured':
        return `appears when "${parentField.label}" is not answered`;
      case 'isEmpty':
        return `appears when "${parentField.label}" is empty`;
      case 'countGreaterThan':
        return `appears when "${parentField.label}" has more than ${field.dependsOn.triggerCount} item(s)`;
      default:
        return '';
    }
  };

  // NEW: Detect circular dependencies
  const detectCircularDependencies = () => {
    const warnings: string[] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycle = (fieldId: string): boolean => {
      visited.add(fieldId);
      recursionStack.add(fieldId);

      const field = sections.flatMap(s => s.fields).find(f => f.id === fieldId);
      if (field?.dependsOn) {
        const dependsOnId = field.dependsOn.fieldId;
        if (!visited.has(dependsOnId)) {
          if (hasCycle(dependsOnId)) return true;
        } else if (recursionStack.has(dependsOnId)) {
          return true;
        }
      }

      recursionStack.delete(fieldId);
      return false;
    };

    sections.forEach(sec => {
      sec.fields.forEach(field => {
        if (!visited.has(field.id) && hasCycle(field.id)) {
          warnings.push(`⚠️ Circular dependency detected involving "${field.label}"`);
        }
      });
    });

    setCircularDependencyWarnings(warnings);
    return warnings;
  };

  // NEW: Calculate quality indicator (respects conditional logic and only counts required fields)
  const calculateQualityScore = (report: BuildingReport): { score: number; status: 'complete' | 'incomplete' | 'partial' } => {
    const data = report.full_data;
    let filled = 0;
    let total = 0;
    
    sections.forEach(sec => {
      sec.fields.forEach(f => {
        // Only count fields that are REQUIRED and VISIBLE (condition satisfied)
        if (f.required && isConditionSatisfied(f, data)) {
          total++;
          const val = data[f.label];
          if (val !== undefined && val !== null && val !== '') {
            if (Array.isArray(val) && val.length > 0) filled++;
            else if (!Array.isArray(val)) filled++;
          }
        }
        // Skip optional fields and fields with unmet conditions - don't count them at all
      });
    });
    
    const score = total === 0 ? 0 : Math.round((filled / total) * 100);
    return {
      score,
      status: score === 100 ? 'complete' : score >= 50 ? 'partial' : 'incomplete'
    };
  };

  // NEW: Add audit log entry
  const addAuditLogEntry = (fieldLabel: string, oldValue: any, newValue: any) => {
    setAuditLog(prev => [...prev, {
      id: Date.now().toString(),
      fieldLabel,
      oldValue,
      newValue,
      timestamp: new Date(),
      userId: 'current_user'
    }]);
  };

  // FIXED: Check for missing required fields - now respects conditional logic
  const validateRequiredFields = (): { missing: string[]; conditionNotMet: string[] } => {
    const missing: string[] = [];
    const conditionNotMet: string[] = [];
    
    sections.forEach(sec => {
      sec.fields.forEach(f => {
        if (f.required) {
          // Check if this field's condition is satisfied
          const conditionMet = isConditionSatisfied(f);
          
          if (conditionMet) {
            // Only validate as required if the condition is met and field is visible
            const val = formData[f.label];
            if (!val || (Array.isArray(val) && val.length === 0) || val === '') {
              missing.push(`${f.label} (${sec.title})`);
            }
          } else if (f.dependsOn) {
            // Track which required fields have unmet conditions
            conditionNotMet.push(`${f.label} - ${getConditionDescription(f)}`);
          }
        }
      });
    });
    
    return { missing, conditionNotMet };
  };

  // NEW: Filter reports logic
  const getFilteredReports = () => {
    let filtered = reports;
    
    if (searchQuery) {
      filtered = filtered.filter(r => r.building_id.toLowerCase().includes(searchQuery.toLowerCase()));
    }
    
    if (filterDateFrom) {
      const fromDate = new Date(filterDateFrom);
      filtered = filtered.filter(r => new Date(r.created_at) >= fromDate);
    }
    
    if (filterDateTo) {
      const toDate = new Date(filterDateTo);
      toDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter(r => new Date(r.created_at) <= toDate);
    }
    
    if (filterStatus !== 'all') {
      filtered = filtered.filter(r => {
        const quality = calculateQualityScore(r);
        return filterStatus === 'complete' ? quality.status === 'complete' : quality.status !== 'complete';
      });
    }
    
    return filtered;
  };

  // NEW: Batch export selected reports
  const batchExportSelected = async () => {
    if (batchSelectedReports.size === 0) return alert('Select reports first');
    const selectedReportsData = reports.filter(r => batchSelectedReports.has(r.id));
    await exportToExcel(selectedReportsData);
    setBatchSelectedReports(new Set());
  };
  
  const runSync = async () => {
    if (!isOnline || syncing) return;
    setSyncing(true);
    try {
      const pending = await localDB.outbox.toArray();
      for (const report of pending) {
        const processedData = JSON.parse(JSON.stringify(report.full_data));
        for (const key in processedData) {
            const val = processedData[key];
            if (Array.isArray(val) && val.length > 0 && typeof val[0] === 'object' && val[0].isLocal) {
                const uploadedImages: ImageObject[] = [];
                for (const img of val) {
                    if (img.isLocal) {
                        const res = await fetch(img.url);
                        const blob = await res.blob();
                        const file = new File([blob], `offline-${Date.now()}.jpg`, { type: "image/jpeg" });
                        const formData = new FormData();
                        formData.append('file', file);
                        const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData });
                        const uploadData = await uploadRes.json();
                        if (uploadData.url) uploadedImages.push({ url: uploadData.url, label: img.label, isLocal: false });
                    } else { uploadedImages.push(img); }
                }
                processedData[key] = uploadedImages;
            }
        }
        const { error } = await supabase.from('building_reports').insert([{ building_id: report.building_id, full_data: processedData, created_at: new Date(report.timestamp).toISOString() }]);
        if (!error) await localDB.outbox.delete(report.id!);
      }
      await checkPending(); loadReports(); alert(`Synced ${pending.length} reports.`);
    } catch (e) { alert("Sync interrupted."); } finally { setSyncing(false); }
  };

  const submitReport = async () => {
    if (!formData['Building ID']) return alert("Critical: Building ID Required.");
    
    // FIXED: Validate required fields with conditional logic
    const { missing, conditionNotMet } = validateRequiredFields();
    if (missing.length > 0) {
      const fieldList = missing.join('\n• ');
      let message = `⚠️ Missing Required Fields:\n• ${fieldList}\n\nPlease fill these before submitting.`;
      if (conditionNotMet.length > 0) {
        message += `\n\n📌 Note: The following required fields did not appear because their conditions weren't met:\n• ${conditionNotMet.join('\n• ')}`;
      }
      return alert(message);
    }

    // Add end time and duration
    const endTime = Date.now();
    const startTime = formData['__startTime'] || surveyStartTime || endTime;
    const duration = Math.round((endTime - startTime) / 1000); // Duration in seconds
    
    const fullData = {
      ...formData,
      '__endTime': endTime,
      '__duration': duration
    } as Record<string, any>;

    const entry = { building_id: fullData['Building ID'], full_data: fullData, timestamp: endTime };
    if (isOnline) {
      try {
          const { error } = await supabase.from('building_reports').insert([{ building_id: entry.building_id, full_data: entry.full_data }]);
          if (!error) { 
            // ✅ Increment counter ONLY on successful submission
            incrementSurveyCounter(surveyorName);
            alert("✅ Packet Uploaded!"); 
            localStorage.removeItem('formDataDraft'); 
            setFormData({}); 
            setSurveyStartTime(null);
            setUnsavedChanges(false); 
            loadReports(); 
          } else { throw new Error("DB Error"); }
      } catch (e) { 
        await localDB.outbox.add(entry); 
        await checkPending(); 
        alert("⚠️ Connection unstable. Saved Locally."); 
        setFormData({}); 
        setSurveyStartTime(null);
        setUnsavedChanges(false); 
      }
    } else {
      await localDB.outbox.add(entry); 
      await checkPending(); 
      // ✅ Increment counter on offline save too (will be synced later)
      incrementSurveyCounter(surveyorName);
      alert("📦 Offline Mode: Saved to Vault."); 
      setFormData({}); 
      setSurveyStartTime(null);
      setUnsavedChanges(false);
    }
  };

  const handleSaveSurveyorName = () => {
    if (!tempSurveyorName.trim()) {
      alert('Please enter your name');
      return;
    }
    const cleanName = tempSurveyorName.trim().replace(/[^a-zA-Z0-9]/g, '');
    localStorage.setItem('surveyorName', cleanName);
    setSurveyorName(cleanName);
    setShowSurveyorModal(false);
    setTempSurveyorName('');
  };

  const getNextBuildingId = (name: string): string => {
    // Get counter from localStorage for this surveyor (WITHOUT incrementing)
    const counterKey = `survey_counter_${name}`;
    const counter = parseInt(localStorage.getItem(counterKey) || '0', 10);
    const nextNumber = counter + 1;
    return `${name}-${String(nextNumber).padStart(3, '0')}`;
  };

  const incrementSurveyCounter = (name: string): void => {
    // Increment counter ONLY after successful submission
    const counterKey = `survey_counter_${name}`;
    let counter = parseInt(localStorage.getItem(counterKey) || '0', 10);
    counter++;
    localStorage.setItem(counterKey, counter.toString());
  };

  const startNewSurvey = () => {
    if (!surveyorName) {
      setShowSurveyorModal(true);
      return;
    }
    
    const nextBuildingId = getNextBuildingId(surveyorName);
    const startTime = Date.now();
    
    setFormData({
      'Surveyor Name': surveyorName,
      'Building ID': nextBuildingId,
      '__startTime': startTime,
    });
    setSurveyStartTime(startTime);
    setUnsavedChanges(false);
    localStorage.removeItem('formDataDraft');
  };

  const captureGPS = (label: string) => { 
    setLocating(true);
    if (!navigator.geolocation) {
      alert("GPS Error: Hardware sensor not detected.");
      setLocating(false);
      return;
    }
  
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude.toFixed(8);
        const lon = pos.coords.longitude.toFixed(8);
        
        setFormData(prev => ({ 
          ...prev, 
          [label]: `${lat}, ${lon}`,
          [`${label}_LATITUDE`]: lat,
          [`${label}_LONGITUDE`]: lon
        }));
        
        setLocating(false);
        alert("GPS LOCK: Coordinates split into discrete columns.");
      },
      (err) => {
        alert(`SIGNAL ERROR: ${err.message}`);
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
  };

  const addSection = async () => {
    if (!newSectionTitle) return;
    const newSection: Section = { id: Date.now().toString(), title: newSectionTitle, fields: [] };
    const updated = [...sections, newSection];
    await updateSchema(updated); setNewSectionTitle(''); setTargetSectionId(newSection.id);
  };
  
  const renameSection = async (sectionId: string) => {
      const newTitle = prompt("Enter new section name:");
      if (!newTitle) return;
      const updated = sections.map(s => s.id === sectionId ? { ...s, title: newTitle } : s);
      await updateSchema(updated);
  };

  const moveSection = async (index: number, direction: 'up' | 'down') => {
      const newSections = [...sections];
      if (direction === 'up' && index > 0) {
          [newSections[index], newSections[index - 1]] = [newSections[index - 1], newSections[index]];
      } else if (direction === 'down' && index < newSections.length - 1) {
          [newSections[index], newSections[index + 1]] = [newSections[index + 1], newSections[index]];
      }
      await updateSchema(newSections);
  };

  const pushSubField = () => {
      if(!newSubLabel) return;
      const newSub: SubField = {
          id: `sub_${Date.now()}`,
          label: newSubLabel,
          type: newSubType,
          options: newSubType === 'select' ? newSubOptions.filter(o => o.trim() !== '') : undefined
      };
      setTempSubFields([...tempSubFields, newSub]); setNewSubLabel(''); setNewSubOptions(['']);
  };

  const addField = async () => {
    if (!newFieldLabel || !targetSectionId) return alert("Label/Section missing.");
    const newField: CustomField = {
      id: Date.now().toString(), label: newFieldLabel, type: newFieldType,
      tooltip: newFieldTooltip || 'Observation required.',
      options: (newFieldType === 'select' || newFieldType === 'multi_select') ? newOptions.filter(o => o.trim() !== '') : undefined,
      subFields: newFieldType === 'group' ? tempSubFields : undefined,
      required: false,
      allowComments: newFieldAllowComments,
      autoDate: newFieldAutoDate && newFieldType === 'text',
      dependsOn: dependsOnFieldId ? { 
        fieldId: dependsOnFieldId, 
        conditionType: dependsOnConditionType,
        triggerValues: dependsOnConditionType === 'equals' ? dependsOnTriggerValues : undefined,
        triggerCount: dependsOnConditionType === 'countGreaterThan' ? dependsOnTriggerCount : undefined
      } : undefined
    };
    const updatedSections = sections.map(sec => sec.id === targetSectionId ? { ...sec, fields: [...sec.fields, newField] } : sec);
    await updateSchema(updatedSections);
    setNewFieldLabel(''); setNewOptions(['']); setTempSubFields([]);
    setDependsOnFieldId(''); setDependsOnTriggerValues([]); setDependsOnTriggerCount(0); setDependsOnConditionType('equals');
    setNewFieldAllowComments(false);
    setNewFieldAutoDate(false);
  };

  const removeField = async (sectionId: string, fieldId: string) => {
    if(!window.confirm("Remove this field?")) return;
    const updatedSections = sections.map(sec => sec.id === sectionId ? { ...sec, fields: sec.fields.filter(f => f.id !== fieldId) } : sec);
    await updateSchema(updatedSections);
  };

  const moveField = async (sectionId: string, fieldIndex: number, direction: 'up' | 'down') => {
      const updatedSections = sections.map(sec => {
          if (sec.id === sectionId) {
              const newFields = [...sec.fields];
              if (direction === 'up' && fieldIndex > 0) {
                  [newFields[fieldIndex], newFields[fieldIndex - 1]] = [newFields[fieldIndex - 1], newFields[fieldIndex]];
              } else if (direction === 'down' && fieldIndex < newFields.length - 1) {
                  [newFields[fieldIndex], newFields[fieldIndex + 1]] = [newFields[fieldIndex + 1], newFields[fieldIndex]];
              }
              return { ...sec, fields: newFields };
          }
          return sec;
      });
      await updateSchema(updatedSections);
  };

  const removeSection = async (sectionId: string) => {
      if(!window.confirm("Delete section and fields?")) return;
      const updated = sections.filter(s => s.id !== sectionId);
      await updateSchema(updated); if(updated.length > 0) setTargetSectionId(updated[0].id);
  }

  const updateSchema = async (newSections: Section[]) => {
      setSections(newSections);
      const { data } = await supabase.from('survey_schema').select('id').single();
      if (data) { await supabase.from('survey_schema').update({ fields: newSections }).eq('id', data.id); } 
      else { await supabase.from('survey_schema').insert([{ fields: newSections }]); }
  }

  const deleteSelected = async () => {
    if (batchSelectedReports.size === 0) {
      alert('Select records to purge first');
      return;
    }
    if (!window.confirm(`Purge ${batchSelectedReports.size} records permanently? This cannot be undone.`)) return;
    
    try {
      const filesToPurge: string[] = [];
      reports.filter(r => batchSelectedReports.has(r.id)).forEach(report => {
        Object.values(report.full_data).forEach(val => {
          if (Array.isArray(val)) {
            val.forEach((i: any) => { 
              if(i.url && i.url.includes('r2')) {
                const fileName = i.url.split('/').pop();
                if (fileName) filesToPurge.push(fileName);
              }
            });
          }
        });
      });
      
      console.log(`Deleting ${batchSelectedReports.size} records and ${filesToPurge.length} R2 files`);
      
      // Delete R2 files first
      if (filesToPurge.length > 0) {
        const deleteRes = await fetch('/api/delete-file', { 
          method: 'POST', 
          body: JSON.stringify({ keys: filesToPurge }),
          headers: { 'Content-Type': 'application/json' }
        });
        if (!deleteRes.ok) {
          console.error('R2 delete error:', await deleteRes.text());
        }
      }
      
      // Then delete database records
      const { error } = await supabase.from('building_reports').delete().in('id', Array.from(batchSelectedReports));
      if (error) {
        console.error('Database delete error:', error);
        alert(`Error deleting records: ${error.message}`);
        return;
      }
      
      setBatchSelectedReports(new Set());
      await loadReports();
      alert(`Successfully purged ${batchSelectedReports.size} records.`);
    } catch (err) {
      console.error('Purge error:', err);
      alert(`Purge failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const saveEditedReport = async () => {
    if (!editingReport) return;
    const { error } = await supabase.from('building_reports').update({ 
      full_data: editingReport.full_data,
      building_id: editingReport.full_data['Building ID'] || editingReport.building_id
    }).eq('id', editingReport.id);
    if (!error) { alert("Changes Saved."); setEditingReport(null); loadReports(); }
  };
  
  const handleEditChange = (fieldLabel: string, value: any) => {
      if (!editingReport) return;
      setEditingReport({ ...editingReport, full_data: { ...editingReport.full_data, [fieldLabel]: value } });
  };

  const exportToExcel = async (subset?: BuildingReport[]) => {
    const dataToExport = (subset || reports).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    if (dataToExport.length === 0) return alert('No data.');

    const workbook = new ExcelJS.Workbook();
    const hiddenLabels = new Set(['__startTime', '__endTime', '__duration']);
    const dynamicSeriesLabelMap = new Map<string, string[]>();

    dataToExport.forEach(report => {
      Object.entries(report.full_data || {}).forEach(([key, value]) => {
        if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object' && value[0].label && value[0].value !== undefined) {
          dynamicSeriesLabelMap.set(key, value.map((item: DynamicSeriesItem) => item.label));
        }
      });
    });

    interface TransposedRow {
      section: string;
      question: string;
      getValue: (report: BuildingReport) => any;
      isImage?: boolean;
    }

    const addTransposedSheet = (sheetName: string, rows: TransposedRow[], sheetReports: BuildingReport[]) => {
      const sheet = workbook.addWorksheet(sheetName);
      const surveyHeaders = sheetReports.map(report => report.full_data?.['Building ID'] || report.building_id || report.id || 'Unknown Survey');
      const lastCol = Math.max(1, surveyHeaders.length + 1);

      sheet.views = [{ state: 'frozen', xSplit: 1, ySplit: 1 }];

      const headerRow = sheet.getRow(1);
      headerRow.getCell(1).value = 'Question';
      surveyHeaders.forEach((header, index) => {
        headerRow.getCell(index + 2).value = header;
      });
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF001F3F' } };
      headerRow.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      headerRow.height = 24;

      let rowIndex = 2;
      let activeSection = '';

      rows.forEach(row => {
        if (row.section !== activeSection) {
          activeSection = row.section;
          const startSectionRow = rowIndex;
          const endSectionRow = rowIndex + 2;
          sheet.mergeCells(startSectionRow, 1, endSectionRow, 1);
          const sectionCell = sheet.getCell(startSectionRow, 1);
          sectionCell.value = activeSection;
          sectionCell.font = { bold: true, color: { argb: 'FF111111' }, size: 12 };
          sectionCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFDC00' } };
          sectionCell.alignment = { horizontal: 'center', vertical: 'middle' };
          rowIndex = endSectionRow + 1;
        }

        const questionCell = sheet.getCell(rowIndex, 1);
        questionCell.value = row.question;
        questionCell.font = { bold: true, color: { argb: 'FF111111' } };
        questionCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };

        sheetReports.forEach((report, reportIndex) => {
          const cell = sheet.getCell(rowIndex, reportIndex + 2);
          const value = row.getValue(report);

          if (row.isImage) {
            const photos = Array.isArray(value) ? value as ImageObject[] : [];
            if (photos.length > 0) {
              const caption = photos.map((photo, idx) => (photo.label && photo.label.trim()) ? photo.label : `Photo ${idx + 1}`).join(' | ');
              const targetUrl = photos.find(photo => photo.url)?.url;
              if (targetUrl) {
                cell.value = { text: caption, hyperlink: targetUrl };
                cell.font = { color: { argb: 'FF1D4ED8' }, underline: true };
              } else {
                cell.value = caption;
              }
            } else {
              cell.value = '';
            }
          } else if (Array.isArray(value)) {
            cell.value = value.join(', ');
          } else {
            cell.value = value ?? '';
          }
        });

        rowIndex += 1;
      });

      const finalRow = Math.max(1, rowIndex - 1);
      for (let r = 1; r <= finalRow; r++) {
        for (let c = 1; c <= lastCol; c++) {
          const cell = sheet.getCell(r, c);
          cell.alignment = { horizontal: c === 1 ? 'left' : 'center', vertical: 'middle', wrapText: true };
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          };
        }
      }

      sheet.getColumn(1).width = 58;
      for (let c = 2; c <= lastCol; c++) {
        sheet.getColumn(c).width = 26;
      }
    };

    const generalRows: TransposedRow[] = [
      {
        section: 'Survey Metadata',
        question: 'Building ID',
        getValue: (report) => report.full_data?.['Building ID'] || report.building_id || report.id || ''
      },
      {
        section: 'Survey Metadata',
        question: 'Typology Selected',
        getValue: (report) => parseTypologySpecificData(report.full_data?.typology_specific_data).selected_type || ''
      },
      {
        section: 'Survey Metadata',
        question: 'Surveyor Name',
        getValue: (report) => report.full_data?.['Surveyor Name'] || ''
      },
      {
        section: 'Survey Metadata',
        question: 'Date Submitted',
        getValue: (report) => report.created_at ? new Date(report.created_at).toLocaleDateString() : ''
      }
    ];

    sections.forEach(section => {
      section.fields.forEach(field => {
        if (hiddenLabels.has(field.label) || field.label === 'Building ID' || field.label === 'Surveyor Name') return;

        if (field.type === 'group' && field.subFields) {
          field.subFields.forEach(sub => {
            const key = `${field.label} [${sub.label}]`;
            generalRows.push({
              section: section.title,
              question: key,
              getValue: (report) => report.full_data?.[key] ?? ''
            });
          });
          return;
        }

        if (field.type === 'dynamic_series') {
          const labels = dynamicSeriesLabelMap.get(field.label) || [];
          if (labels.length === 0) {
            generalRows.push({
              section: section.title,
              question: field.label,
              getValue: () => ''
            });
          } else {
            labels.forEach(label => {
              generalRows.push({
                section: section.title,
                question: `${field.label} [${label}]`,
                getValue: (report) => {
                  const rows = Array.isArray(report.full_data?.[field.label]) ? report.full_data[field.label] : [];
                  const match = rows.find((item: DynamicSeriesItem) => item.label === label);
                  return match?.value ?? '';
                }
              });
            });
          }
          return;
        }

        if (field.type === 'image') {
          generalRows.push({
            section: section.title,
            question: field.label,
            getValue: (report) => Array.isArray(report.full_data?.[field.label]) ? report.full_data[field.label] : [],
            isImage: true
          });
          return;
        }

        generalRows.push({
          section: section.title,
          question: field.label,
          getValue: (report) => report.full_data?.[field.label] ?? ''
        });
      });
    });

    addTransposedSheet('General Data', generalRows, dataToExport);

    TYPOLOGY_DEFINITIONS.forEach(def => {
      const rows: TransposedRow[] = def.fields.map(field => ({
        section: def.label,
        question: field.label,
        getValue: (report) => {
          const parsed = parseTypologySpecificData(report.full_data?.typology_specific_data);
          if (parsed.selected_type !== def.label) return '';
          if (!isTypologyFieldVisible(field, parsed.responses || {})) return '';
          return parsed.responses?.[field.id] ?? '';
        }
      }));

      const typologyReports = dataToExport.filter(report => {
        const parsed = parseTypologySpecificData(report.full_data?.typology_specific_data);
        return parsed.selected_type === def.label;
      });

      addTransposedSheet(def.sheetName, rows, typologyReports);
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `UET_EPFL_Report_${Date.now()}.xlsx`);
  };

  const exportSchema = () => {
    const dataStr = JSON.stringify(sections, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `schema_${Date.now()}.json`;
    link.click();
  };

  const importSchema = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const imported = JSON.parse(e.target?.result as string) as Section[];
        await updateSchema(imported);
        alert('Schema imported successfully!');
      } catch (err) {
        alert('Error importing schema. Check file format.');
      }
    };
    reader.readAsText(file);
  };

  const toggleFieldRequired = async (sectionId: string, fieldId: string) => {
    const updatedSections = sections.map(sec => {
      if (sec.id === sectionId) {
        return {
          ...sec,
          fields: sec.fields.map(f => f.id === fieldId ? { ...f, required: !f.required } : f)
        };
      }
      return sec;
    });
    await updateSchema(updatedSections);
  };

  const toggleFieldAllowComments = async (sectionId: string, fieldId: string) => {
    const updatedSections = sections.map(sec => {
      if (sec.id === sectionId) {
        return {
          ...sec,
          fields: sec.fields.map(f => f.id === fieldId ? { ...f, allowComments: !f.allowComments } : f)
        };
      }
      return sec;
    });
    await updateSchema(updatedSections);
  };

  const updateFieldTypeAsync = async (sectionId: string, fieldId: string, newType: FieldType) => {
    const updatedSections = sections.map(sec => {
      if (sec.id === sectionId) {
        return {
          ...sec,
          fields: sec.fields.map(f => {
            if (f.id === fieldId) {
              // When changing type, clear type-specific properties
              const updated: CustomField = { ...f, type: newType };
              if (newType !== 'select' && newType !== 'multi_select') updated.options = undefined;
              if (newType !== 'group') updated.subFields = undefined;
              return updated;
            }
            return f;
          })
        };
      }
      return sec;
    });
    await updateSchema(updatedSections);
  };

  const updateFieldOptions = async (sectionId: string, fieldId: string, newOptions: string[]) => {
    const updatedSections = sections.map(sec => {
      if (sec.id === sectionId) {
        return {
          ...sec,
          fields: sec.fields.map(f => f.id === fieldId ? { ...f, options: newOptions } : f)
        };
      }
      return sec;
    });
    await updateSchema(updatedSections);
  };

  const openFieldEditModal = (fieldId: string, sectionId: string, fieldType: FieldType, fieldOptions?: string[], fieldLabel?: string) => {
    setEditingFieldId(fieldId);
    setEditingFieldSectionId(sectionId);
    setEditFieldType(fieldType);
    setEditFieldOptions(fieldOptions || []);
    setEditingFieldNewLabel(fieldLabel || '');
    setFieldSaveStatus('idle');

    // Ensure the opened inline editor is brought into view.
    setTimeout(() => {
      const target = document.getElementById(`field-card-${sectionId}-${fieldId}`);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 0);
  };

  const editFieldLabel = async (sectionId: string, fieldId: string, newLabel: string) => {
    if (!newLabel.trim()) return;
    const updatedSections = sections.map(sec => {
      if (sec.id === sectionId) {
        return {
          ...sec,
          fields: sec.fields.map(f => f.id === fieldId ? { ...f, label: newLabel.trim() } : f)
        };
      }
      return sec;
    });
    await updateSchema(updatedSections);
  };

  const saveFieldEditsAtomic = async (sectionId: string, fieldId: string, newLabel: string, newType: FieldType, newOptions: string[]) => {
    const label = newLabel.trim();
    if (!label) return;

    const normalizedOptions = newOptions.map(opt => opt.trim()).filter(Boolean);
    const updatedSections = sections.map(sec => {
      if (sec.id !== sectionId) return sec;

      return {
        ...sec,
        fields: sec.fields.map(f => {
          if (f.id !== fieldId) return f;

          const updated: CustomField = {
            ...f,
            label,
            type: newType
          };

          if (newType === 'select' || newType === 'multi_select') {
            updated.options = normalizedOptions;
          } else {
            updated.options = undefined;
          }

          if (newType !== 'group') {
            updated.subFields = undefined;
          }

          return updated;
        })
      };
    });

    await updateSchema(updatedSections);
  };

  const moveFieldBetweenSections = async (fromSectionId: string, toSectionId: string, fieldIndex: number) => {
    const fromSection = sections.find(s => s.id === fromSectionId);
    if (!fromSection || fieldIndex < 0 || fieldIndex >= fromSection.fields.length) return;
    
    const fieldToMove = fromSection.fields[fieldIndex];
    const updatedSections = sections.map(sec => {
      if (sec.id === fromSectionId) {
        return { ...sec, fields: sec.fields.filter((_, idx) => idx !== fieldIndex) };
      }
      if (sec.id === toSectionId) {
        return { ...sec, fields: [...sec.fields, fieldToMove] };
      }
      return sec;
    });
    await updateSchema(updatedSections);
  };

  const filteredReports = reports.filter(r => r.building_id.toLowerCase().includes(searchQuery.toLowerCase()));
  const paginatedReports = filteredReports.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const shouldShowField = (field: CustomField): boolean => {
    if (!field.dependsOn) return true;
    const parentField = sections.flatMap(s => s.fields).find(f => f.id === field.dependsOn?.fieldId);
    if (!parentField) return true;
    const parentValue = formData[parentField.label];
    
    switch (field.dependsOn.conditionType) {
      case 'equals':
        return field.dependsOn.triggerValues ? field.dependsOn.triggerValues.includes(String(parentValue)) : false;
      case 'notCaptured':
        return !parentValue || (Array.isArray(parentValue) && parentValue.length === 0);
      case 'isEmpty':
        return !parentValue || String(parentValue).trim() === '';
      case 'countGreaterThan':
        if (Array.isArray(parentValue)) return parentValue.length > (field.dependsOn.triggerCount || 0);
        return false;
      default:
        return true;
    }
  };

  const currentTypologyData = getCurrentTypologyData();
  const selectedTypologyDefinition = currentTypologyData.selected_type ? TYPOLOGY_DEFINITION_MAP[currentTypologyData.selected_type] : undefined;

  return (
    <div className={`max-w-screen-lg mx-auto px-4 pb-32 pt-6 space-y-8 min-h-screen ${darkMode ? 'bg-slate-900 text-white' : 'bg-[#F5F5F5] text-black'}`}>
      
      <div className="text-center space-y-1">
         <h1 className="text-2xl md:text-3xl font-black text-[#001F3F] tracking-tighter">Survey</h1>
         <p className="text-xs font-bold text-[#85144B] uppercase tracking-[0.2em]">Building Specific Survey</p>
      </div>

      <div className={`p-4 rounded-xl border-2 flex items-center justify-between shadow-sm ${isOnline ? 'bg-green-50 border-green-200' : 'bg-orange-50 border-orange-200'}`}>
        <div className="flex items-center gap-2">
          {isOnline ? <Wifi className="text-green-700" size={20} /> : <WifiOff className="text-orange-700" size={20} />}
          <span className={`text-xs font-black uppercase ${isOnline ? 'text-green-900' : 'text-orange-900'}`}>{isOnline ? 'System Online' : 'Offline Vault Active'}</span>
        </div>
        {pendingCount > 0 && isOnline && (
          <button onClick={runSync} disabled={syncing} className="bg-[#85144B] text-white px-4 py-2 rounded-lg text-xs font-black animate-pulse flex items-center gap-2 shadow-md">
            <RefreshCcw size={14} className={syncing ? 'animate-spin' : ''} /> PUSH {pendingCount}
          </button>
        )}
      </div>

      <div className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          {!isAdmin && <button onClick={() => exportToExcel()} className="text-[10px] font-black bg-white px-3 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-[#001F3F] hover:text-[#39CCCC] transition-colors flex items-center gap-2"><FileDown size={14} /> EXCEL</button>}
          {unsavedChanges && <span className="text-[10px] font-black text-orange-600">💾 Unsaved Changes</span>}
          {lastSaved && <span className="text-[9px] text-slate-500">Last saved: {lastSaved.toLocaleTimeString()}</span>}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setDarkMode(!darkMode)} title="Toggle Dark Mode" className="text-[10px] font-black px-2 py-1 rounded bg-slate-100 hover:bg-slate-200">{darkMode ? '☀️' : '🌙'}</button>
          <button onClick={() => isAdmin ? setIsAdmin(false) : setShowAdminPanel(!showAdminPanel)} className="text-[10px] font-black text-slate-400 hover:text-blue-600 uppercase tracking-wider">{isAdmin ? 'Exit Admin' : 'Admin'}</button>
        </div>
      </div>

      {showAdminPanel && !isAdmin && (
        <div className="bg-slate-100 p-6 rounded-2xl border-2 border-dashed border-slate-300 max-w-sm mx-auto text-center">
          <input type="password" placeholder="Passcode" className="w-full p-3 rounded-xl border text-center font-bold text-lg mb-3 text-black" value={password} onChange={(e) => setPassword(e.target.value)} />
          <button onClick={() => password === 'swiss2026' ? (setIsAdmin(true), setShowAdminPanel(false), setPassword('')) : alert('Denied')} className="w-full bg-[#001F3F] text-[#39CCCC] p-3 rounded-xl font-black text-xs uppercase">Login</button>
        </div>
      )}

      {/* ADMIN DASHBOARD */}
      {isAdmin && (
        <div className="space-y-6 animate-in slide-in-from-top-4">
          {/* Tab Navigation */}
          <div className="flex gap-2 bg-white p-3 rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
            <button onClick={() => setAdminTab('schema')} className={`px-4 py-2 rounded-lg text-xs font-black uppercase whitespace-nowrap transition-all ${adminTab === 'schema' ? 'bg-[#001F3F] text-[#39CCCC]' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>📋 Schema</button>
            <button onClick={() => setAdminTab('logic')} className={`px-4 py-2 rounded-lg text-xs font-black uppercase whitespace-nowrap transition-all ${adminTab === 'logic' ? 'bg-[#001F3F] text-[#39CCCC]' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>⚙️ Logic</button>
            <button onClick={() => setAdminTab('preview')} className={`px-4 py-2 rounded-lg text-xs font-black uppercase whitespace-nowrap transition-all ${adminTab === 'preview' ? 'bg-[#001F3F] text-[#39CCCC]' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>👁️ Preview</button>
            <button onClick={() => setAdminTab('access')} className={`px-4 py-2 rounded-lg text-xs font-black uppercase whitespace-nowrap transition-all ${adminTab === 'access' ? 'bg-[#001F3F] text-[#39CCCC]' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>👥 Access</button>
            <div className="ml-auto flex gap-2">
              <button onClick={exportSchema} className="px-3 py-2 rounded-lg text-xs font-black bg-green-100 text-green-700 hover:bg-green-200"><FileDown size={12} /></button>
              <label className="px-3 py-2 rounded-lg text-xs font-black bg-blue-100 text-blue-700 hover:bg-blue-200 cursor-pointer">
                📂 Import
                <input type="file" accept=".json" onChange={importSchema} className="hidden" />
              </label>
            </div>
          </div>

          {/* Data Records Panel */}
          <div className="bg-white p-6 rounded-3xl border-2 border-[#001F3F] shadow-xl space-y-4">
             <div className="flex justify-between items-center border-b pb-3">
                 <h3 className="font-black text-[#001F3F] text-xs">📊 DATA RECORDS ({getFilteredReports().length})</h3>
                 <div className="flex gap-2">
                   {batchSelectedReports.size > 0 && (
                     <>
                       <button onClick={batchExportSelected} className="bg-green-600 text-white text-[10px] font-bold px-3 py-1 rounded">📥 EXPORT {batchSelectedReports.size}</button>
                       <button onClick={deleteSelected} className="bg-red-600 text-white text-[10px] font-bold px-3 py-1 rounded">🗑️ PURGE ({batchSelectedReports.size})</button>
                     </>
                   )}
                   <button onClick={() => setShowAuditLog(!showAuditLog)} className="bg-blue-600 text-white text-[10px] font-bold px-3 py-1 rounded">📋 AUDIT LOG</button>
                 </div>
             </div>

             {/* Filters */}
             <div className="bg-slate-50 p-4 rounded-lg space-y-3 border border-slate-200">
               <p className="text-[10px] font-bold text-slate-700">🔍 FILTERS</p>
               <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                 <input type="text" placeholder="Search ID..." className="p-2 bg-white border rounded-lg text-xs text-black" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                 <input type="date" className="p-2 bg-white border rounded-lg text-xs text-black" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} />
                 <input type="date" className="p-2 bg-white border rounded-lg text-xs text-black" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} />
                 <select className="p-2 bg-white border rounded-lg text-xs text-black" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as any)}>
                   <option value="all">All Status</option>
                   <option value="complete">✅ Complete</option>
                   <option value="incomplete">❌ Incomplete</option>
                 </select>
               </div>
             </div>

             <div className="max-h-96 overflow-y-auto">
                 {getFilteredReports().length === 0 ? <p className="text-xs text-slate-500 p-4">No records found</p> : getFilteredReports().map(r => {
                   return (
                     <div key={r.id} className="flex justify-between items-center p-3 border-b text-xs">
                         <div className="flex-1">
                           <div className="flex items-center gap-2">
                             <span className="font-bold text-black">{r.building_id}</span>
                             <span className="text-[10px] text-slate-600">{new Date(r.created_at).toLocaleDateString()}</span>
                           </div>
                         </div>
                         <div className="flex gap-2">
                             <button onClick={() => setViewingImages(Object.values(r.full_data).flatMap(v => (Array.isArray(v) && v[0]?.url) ? v : []))} className="text-[#001F3F]"><Eye size={14}/></button>
                             <button onClick={() => setEditingReport(r)} className="text-[#001F3F]"><Edit3 size={14}/></button>
                             <input type="checkbox" checked={batchSelectedReports.has(r.id)} onChange={() => { const n = new Set(batchSelectedReports); n.has(r.id) ? n.delete(r.id) : n.add(r.id); setBatchSelectedReports(n); }} />
                         </div>
                     </div>
                   );
                 })}
             </div>
          </div>

          {/* Audit Log Modal */}
          {showAuditLog && (
            <div className="bg-white p-6 rounded-3xl border-2 border-[#001F3F] shadow-xl max-h-80 overflow-y-auto">
              <div className="flex justify-between items-center border-b pb-3 mb-4">
                <h3 className="font-black text-[#001F3F] text-xs">📋 FIELD HISTORY & AUDIT LOG</h3>
                <button onClick={() => setShowAuditLog(false)} className="text-slate-400 hover:text-slate-600"><X size={16}/></button>
              </div>
              {auditLog.length === 0 ? (
                <p className="text-xs text-slate-500">No changes recorded yet</p>
              ) : (
                auditLog.map(entry => (
                  <div key={entry.id} className="text-[9px] border-b py-2 mb-2">
                    <p className="font-bold text-[#001F3F]">{entry.fieldLabel}</p>
                    <p className="text-slate-600">Changed: {entry.timestamp.toLocaleString()}</p>
                    <p className="text-slate-500">By: {entry.userId}</p>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 1: SCHEMA */}
          {adminTab === 'schema' && (
            <div className="bg-[#001F3F] p-6 rounded-3xl text-white space-y-6 shadow-lg">
              <h3 className="text-xs font-black uppercase text-[#39CCCC] border-b border-white/20 pb-2">📝 Manage Sections</h3>
              <div className="space-y-3">
                <div className="flex gap-2">
                  <input type="text" placeholder="New Section Name" className="flex-1 p-3 bg-white/10 rounded-xl text-xs font-bold border border-white/10 text-white" value={newSectionTitle} onChange={(e) => setNewSectionTitle(e.target.value)} />
                  <button onClick={addSection} className="bg-[#39CCCC] text-[#001F3F] px-6 rounded-xl font-black text-xs">+ ADD</button>
                </div>
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {sections.map((sec, idx) => (
                    <div key={sec.id} className="bg-white/10 p-3 rounded-lg flex justify-between items-center">
                      <span className="text-xs font-bold">{sec.title}</span>
                      <div className="flex gap-2">
                        <button onClick={() => moveSection(idx, 'up')} disabled={idx === 0} className="text-gray-300 hover:text-[#39CCCC] disabled:opacity-30"><ArrowUp size={14}/></button>
                        <button onClick={() => moveSection(idx, 'down')} disabled={idx === sections.length - 1} className="text-gray-300 hover:text-[#39CCCC] disabled:opacity-30"><ArrowDown size={14}/></button>
                        <button onClick={() => renameSection(sec.id)} className="text-blue-300 hover:text-[#39CCCC]"><PenTool size={14}/></button>
                        <button onClick={() => removeSection(sec.id)} className="text-red-300 hover:text-red-500"><Trash2 size={14} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: LOGIC */}
          {adminTab === 'logic' && (
            <div className="bg-[#001F3F] p-6 rounded-3xl text-white space-y-6 shadow-lg">
              <h3 className="text-xs font-black uppercase text-[#39CCCC] border-b border-white/20 pb-2">⚙️ Add Field with Logic</h3>
              <div className="space-y-4">
                <select className="w-full p-3 bg-white rounded-xl text-xs font-bold text-black" value={targetSectionId} onChange={(e) => setTargetSectionId(e.target.value)}>
                    <option value="">Select Target Section...</option>
                    {sections.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
                </select>

                {/* Quick-Add Field Buttons */}
                <div className="bg-black/20 p-4 rounded-xl">
                  <p className="text-[10px] font-bold text-[#39CCCC] mb-3">⚡ Quick Add:</p>
                  <div className="grid grid-cols-3 gap-2">
                    <button onClick={() => quickAddField('text', 'New Text Field')} className="bg-blue-500 hover:bg-blue-600 text-white text-[10px] font-bold py-2 px-3 rounded transition">📝 Text</button>
                    <button onClick={() => quickAddField('date', 'New Date')} className="bg-cyan-500 hover:bg-cyan-600 text-white text-[10px] font-bold py-2 px-3 rounded transition">📅 Date</button>
                    <button onClick={() => quickAddField('select', 'New Dropdown')} className="bg-green-500 hover:bg-green-600 text-white text-[10px] font-bold py-2 px-3 rounded transition">📋 Dropdown</button>
                    <button onClick={() => quickAddField('image', 'New Photos')} className="bg-orange-500 hover:bg-orange-600 text-white text-[10px] font-bold py-2 px-3 rounded transition">📷 Photos</button>
                    <button onClick={() => quickAddField('number', 'New Number')} className="bg-purple-500 hover:bg-purple-600 text-white text-[10px] font-bold py-2 px-3 rounded transition">🔢 Number</button>
                    <button onClick={() => quickAddField('gps', 'Location')} className="bg-pink-500 hover:bg-pink-600 text-white text-[10px] font-bold py-2 px-3 rounded transition">📍 GPS</button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <input type="text" placeholder="Field Label" className="p-3 bg-white/10 rounded-xl text-xs font-bold border border-white/10 text-white" value={newFieldLabel} onChange={(e) => setNewFieldLabel(e.target.value)} />
                    <select className="p-3 bg-white rounded-xl text-xs font-bold text-black" value={newFieldType} onChange={(e) => setNewFieldType(e.target.value as FieldType)}>
                        <option value="text">Text</option><option value="date">Date</option><option value="number">Number</option><option value="select">Dropdown</option><option value="multi_select">Multi-Select</option>
                        <option value="checkbox">Check</option><option value="image">Photo</option><option value="gps">GPS</option>
                        <option value="group">Group (Sub-fields)</option><option value="dynamic_series">Dynamic Series</option>
                    </select>
                </div>
                <input type="text" placeholder="Tooltip/Guidance" className="w-full p-3 bg-white/10 rounded-xl text-xs font-bold border border-white/10 text-white" value={newFieldTooltip} onChange={(e) => setNewFieldTooltip(e.target.value)} />

                <label className="flex items-center gap-2 text-white text-xs cursor-pointer bg-white/5 p-3 rounded-xl border border-white/10">
                  <input type="checkbox" checked={newFieldAllowComments} onChange={(e) => setNewFieldAllowComments(e.target.checked)} className="accent-[#39CCCC] cursor-pointer" />
                  <span className="font-bold">💬 Allow Surveyor Comments</span>
                </label>

                {newFieldType === 'text' && (
                  <label className="flex items-center gap-2 text-white text-xs cursor-pointer bg-white/5 p-3 rounded-xl border border-white/10">
                    <input type="checkbox" checked={newFieldAutoDate} onChange={(e) => setNewFieldAutoDate(e.target.checked)} className="accent-[#39CCCC] cursor-pointer" />
                    <span className="font-bold">📅 Auto-populate with Today's Date</span>
                  </label>
                )}

                {(newFieldType === 'select' || newFieldType === 'multi_select') && (
                  <input type="text" placeholder="Options (comma separated)" className="w-full p-3 bg-white/10 rounded-xl text-xs text-white" value={newOptions.join(',')} onChange={(e) => setNewOptions(e.target.value.split(',').map(o => o.trim()).filter(o => o))} />
                )}

                {newFieldType === 'group' && (
                   <div className="bg-black/20 p-3 rounded-xl space-y-2">
                       <p className="text-[10px] text-[#39CCCC] font-bold">Configure Sub-Fields</p>
                       <div className="grid grid-cols-2 gap-2">
                          <input type="text" placeholder="Label" className="p-2 bg-white/10 text-white text-xs rounded" value={newSubLabel} onChange={(e) => setNewSubLabel(e.target.value)} />
                          <select className="p-2 bg-white text-black text-xs rounded" value={newSubType} onChange={(e) => setNewSubType(e.target.value as SubFieldType)}>
                             <option value="text">Text</option><option value="number">Number</option><option value="select">Select</option><option value="checkbox">Check</option>
                          </select>
                       </div>
                       {newSubType === 'select' && <input type="text" placeholder="Options (comma sep)" className="w-full p-2 bg-white/10 text-white text-xs rounded" value={newSubOptions.join(',')} onChange={(e) => setNewSubOptions(e.target.value.split(',').map(o => o.trim()).filter(o => o))} />}
                       <button onClick={pushSubField} className="w-full bg-[#85144B] text-white text-[10px] p-2 rounded font-bold">+ Add Sub-Field</button>
                       <div className="space-y-1 mt-2">{tempSubFields.map(sf => (<div key={sf.id} className="flex justify-between text-[10px] bg-white/5 p-1 rounded px-2"><span>{sf.label} ({sf.type})</span><button className="text-red-400" onClick={() => setTempSubFields(tempSubFields.filter(t => t.id !== sf.id))}>x</button></div>))}</div>
                   </div>
                )}

                <div className="bg-black/20 p-3 rounded-xl space-y-2">
                    <p className="text-[10px] text-[#39CCCC] font-bold">✨ Conditional Display (Optional)</p>
                    <select className="w-full p-2 bg-white text-black text-xs rounded" value={dependsOnFieldId} onChange={(e) => setDependsOnFieldId(e.target.value)}>
                        <option value="">No Dependency</option>
                        {sections.flatMap(sec => sec.fields).map(field => (
                            <option key={field.id} value={field.id}>{field.label}</option>
                        ))}
                    </select>
                    {dependsOnFieldId && (
                        <div className="space-y-2">
                          <select className="w-full p-2 bg-white text-black text-xs rounded" value={dependsOnConditionType} onChange={(e) => setDependsOnConditionType(e.target.value as any)}>
                            <option value="equals">Equals (visual picker)</option>
                            <option value="notCaptured">Not Captured</option>
                            <option value="isEmpty">Is Empty</option>
                            <option value="countGreaterThan">Count Greater Than</option>
                          </select>

                          {dependsOnConditionType === 'equals' && (
                            <div className="bg-white/5 p-2 rounded space-y-2">
                              <p className="text-[9px] text-white">Select values to trigger:</p>
                              {(() => {
                                const parentField = sections.flatMap(s => s.fields).find(f => f.id === dependsOnFieldId);
                                return parentField?.options?.map(opt => (
                                  <label key={opt} className="flex items-center gap-2 text-[9px] text-white">
                                    <input type="checkbox" checked={dependsOnTriggerValues.includes(opt)} onChange={(e) => {
                                      if (e.target.checked) setDependsOnTriggerValues([...dependsOnTriggerValues, opt]);
                                      else setDependsOnTriggerValues(dependsOnTriggerValues.filter(v => v !== opt));
                                    }} className="accent-[#39CCCC]" />
                                    {opt}
                                  </label>
                                ));
                              })()}
                            </div>
                          )}

                          {dependsOnConditionType === 'countGreaterThan' && (
                            <input type="number" placeholder="Minimum count" min="0" className="w-full p-2 bg-white text-black text-xs rounded" value={dependsOnTriggerCount} onChange={(e) => setDependsOnTriggerCount(parseInt(e.target.value) || 0)} />
                          )}
                        </div>
                    )}
                </div>

                <button onClick={addField} disabled={!targetSectionId} className="w-full bg-[#39CCCC] text-[#001F3F] p-3 rounded-xl font-black text-xs uppercase tracking-widest disabled:opacity-50">🚀 DEPLOY FIELD</button>
            </div>
            </div>
          )}

          {/* TAB 3: PREVIEW */}
          {adminTab === 'preview' && (
            <div className="bg-white p-6 rounded-3xl border-2 border-[#001F3F] shadow-xl space-y-4">
              {/* Circular Dependency Warnings */}
              {circularDependencyWarnings.length > 0 && (
                <div className="bg-red-50 border-2 border-red-300 p-4 rounded-xl">
                  <p className="text-xs font-black text-red-800 mb-2">🚨 CIRCULAR DEPENDENCY WARNINGS:</p>
                  {circularDependencyWarnings.map((warning, idx) => (
                    <p key={idx} className="text-[9px] text-red-700 ml-4">{warning}</p>
                  ))}
                </div>
              )}
              
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xs font-black uppercase text-[#001F3F]">👁️ Live Form Preview</h3>
                <button 
                  onClick={() => setShowConditionalTestMode(!showConditionalTestMode)}
                  className={`text-[10px] font-bold px-3 py-2 rounded-lg transition-all ${showConditionalTestMode ? 'bg-[#001F3F] text-[#39CCCC]' : 'bg-slate-200 text-slate-700'}`}
                >
                  🧪 Test Conditions
                </button>
              </div>
              
              {showConditionalTestMode && (
                <div className="bg-blue-50 border-2 border-blue-300 p-4 rounded-xl space-y-3">
                  <p className="text-xs font-black text-blue-800">Simulate Conditions - Set values to preview field visibility:</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                    {sections.flatMap(s => s.fields).filter(f => f.dependsOn || sections.flatMap(sec => sec.fields).some(field => field.dependsOn?.fieldId === f.id)).map(field => (
                      <div key={field.id}>
                        <p className="text-[9px] font-bold text-blue-900 mb-1">{field.label}</p>
                        {field.type === 'select' && (
                          <select 
                            className="w-full p-2 text-xs rounded border border-blue-300 bg-white text-black"
                            value={testPreviewData[field.label] || ''}
                            onChange={(e) => setTestPreviewData({...testPreviewData, [field.label]: e.target.value})}
                          >
                            <option value="">Select...</option>
                            {field.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                          </select>
                        )}
                        {field.type === 'multi_select' && (
                          <div className="grid grid-cols-1 gap-1">
                            {field.options?.map(opt => (
                              <label key={opt} className="text-[9px] flex items-center gap-1 cursor-pointer">
                                <input 
                                  type="checkbox" 
                                  checked={(testPreviewData[field.label] as string[] || []).includes(opt)}
                                  onChange={(e) => {
                                    const current = testPreviewData[field.label] as string[] || [];
                                    if (e.target.checked) {
                                      setTestPreviewData({...testPreviewData, [field.label]: [...current, opt]});
                                    } else {
                                      setTestPreviewData({...testPreviewData, [field.label]: current.filter(v => v !== opt)});
                                    }
                                  }}
                                  className="accent-blue-600"
                                />
                                {opt}
                              </label>
                            ))}
                          </div>
                        )}
                        {field.type === 'text' && (
                          <input 
                            type="text" 
                            className="w-full p-2 text-xs rounded border border-blue-300 bg-white text-black"
                            value={testPreviewData[field.label] || ''}
                            onChange={(e) => setTestPreviewData({...testPreviewData, [field.label]: e.target.value})}
                            placeholder="Enter test value"
                          />
                        )}
                        {field.type === 'number' && (
                          <input 
                            type="number" 
                            className="w-full p-2 text-xs rounded border border-blue-300 bg-white text-black"
                            value={testPreviewData[field.label] || ''}
                            onChange={(e) => setTestPreviewData({...testPreviewData, [field.label]: e.target.value})}
                            placeholder="Enter test value"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                  <button 
                    onClick={() => setTestPreviewData({})}
                    className="w-full text-[10px] font-bold bg-blue-200 text-blue-800 p-2 rounded hover:bg-blue-300"
                  >
                    🔄 Clear Test Data
                  </button>
                </div>
              )}
              
              <p className="text-[10px] text-slate-600">Changes appear here instantly:</p>
              <div className="bg-[#F5F5F5] p-4 rounded-xl border-2 border-dashed border-slate-300 max-h-96 overflow-y-auto">
                {sections.length === 0 ? (
                  <p className="text-xs text-slate-500">No sections yet. Create one in the Schema tab.</p>
                ) : (
                  <div className="space-y-4">
                    {sections.map((section) => (
                      <div key={section.id} className="space-y-3">
                        <h4 className="text-xs font-black text-[#001F3F] uppercase border-b pb-2">{section.title}</h4>
                        <div className="space-y-2">
                          {section.fields.length === 0 ? (
                            <p className="text-[9px] text-slate-500">No fields in this section</p>
                          ) : (
                            section.fields.map((f) => {
                              const conditionMet = isConditionSatisfied(f, showConditionalTestMode ? testPreviewData : formData);
                              return (
                                <div key={f.id} className={`p-3 rounded-lg border text-[9px] transition-all ${
                                  conditionMet 
                                    ? 'bg-white border-slate-200' 
                                    : 'bg-slate-50 border-dashed border-slate-300 opacity-50'
                                }`}>
                                  <p className="font-bold"><span className="text-[#001F3F]">{f.label}</span> {f.required && <span className="text-red-500 ml-1">*</span>} <span className="text-[7px] bg-slate-100 px-1 rounded text-slate-600">{f.type}</span> {!conditionMet && <span className="text-[7px] bg-slate-200 px-1 rounded text-slate-500 ml-1">HIDDEN</span>}</p>
                                  {f.dependsOn && <p className={`text-[8px] mt-1 ${conditionMet ? 'text-blue-600' : 'text-slate-500 line-through'}`}>⚡ {getConditionDescription(f)}</p>}
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: ACCESS CONTROL */}
          {adminTab === 'access' && (
            <div className="bg-[#001F3F] p-6 rounded-3xl text-white space-y-6 shadow-lg">
              <h3 className="text-xs font-black uppercase text-[#39CCCC] border-b border-white/20 pb-2">👥 Role-Based Access</h3>
              <div className="space-y-4">
                <div className="bg-black/20 p-4 rounded-xl">
                  <p className="text-xs font-bold mb-3">Current Role: <span className="text-[#39CCCC]">{userRole.toUpperCase()}</span></p>
                  <div className="grid grid-cols-2 gap-2">
                    {(['viewer', 'collector', 'editor', 'admin'] as const).map(role => (
                      <button key={role} onClick={() => setUserRole(role)} className={`p-2 rounded-lg text-xs font-bold uppercase transition-all ${userRole === role ? 'bg-[#39CCCC] text-[#001F3F]' : 'bg-white/10 text-white hover:bg-white/20'}`}>
                        {role}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-3 text-[9px]">
                  <div className="bg-white/5 p-3 rounded-lg"><p className="font-bold text-[#39CCCC]">📱 Viewer</p><p>View reports only, no editing</p></div>
                  <div className="bg-white/5 p-3 rounded-lg"><p className="font-bold text-[#39CCCC]">✏️ Collector</p><p>Fill forms & view pending data</p></div>
                  <div className="bg-white/5 p-3 rounded-lg"><p className="font-bold text-[#39CCCC]">✏️ Editor</p><p>Edit submitted data</p></div>
                  <div className="bg-white/5 p-3 rounded-lg"><p className="font-bold text-[#39CCCC]">⚙️ Admin</p><p>Full access: schema, data, users</p></div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 5. USER FORM RENDERER */}
      <div className="space-y-6">
        <div className="flex gap-2 bg-white p-2 rounded-xl border border-slate-200 shadow-sm">
          <button
            onClick={() => setSurveyTab('general')}
            className={`flex-1 px-4 py-2 rounded-lg text-xs font-black uppercase transition-all ${surveyTab === 'general' ? 'bg-[#001F3F] text-[#39CCCC]' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
          >
            General Survey
          </button>
          <button
            onClick={() => setSurveyTab('typology')}
            className={`flex-1 px-4 py-2 rounded-lg text-xs font-black uppercase transition-all ${surveyTab === 'typology' ? 'bg-[#85144B] text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
          >
            Building Typology
          </button>
        </div>

        {surveyTab === 'general' && (
          <div className="space-y-8">
            {sections.map((section, secIdx) => (
              <div key={section.id} className="space-y-4">
                <div className="flex items-center gap-3 border-b-4 border-[#001F3F] pb-2">
                  <Layers className="text-[#001F3F]" size={20} />
                  <h2 className="text-sm font-black text-[#001F3F] uppercase tracking-widest">{section.title}</h2>
                  {isAdmin && (
                    <div className="ml-auto flex gap-2">
                      <button onClick={() => moveSection(secIdx, 'up')} className="text-slate-400 hover:text-blue-500"><ArrowUp size={16}/></button>
                      <button onClick={() => moveSection(secIdx, 'down')} className="text-slate-400 hover:text-blue-500"><ArrowDown size={16}/></button>
                      <button onClick={() => renameSection(section.id)} className="text-blue-500 hover:text-blue-700"><PenTool size={16}/></button>
                      <button onClick={() => removeSection(section.id)} className="text-red-400 hover:text-red-600"><Trash2 size={16}/></button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {section.fields.map((f, fIdx) => (
                    shouldShowField(f) && (
                      <div id={`field-card-${section.id}-${f.id}`} key={f.id} className="bg-white p-4 sm:p-6 rounded-2xl border-2 border-slate-100 shadow-sm relative hover:border-blue-200 transition-colors">
                        <div className="flex justify-between items-center mb-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <label className="text-[10px] sm:text-xs font-black uppercase text-[#111111] flex items-center gap-1">
                              {f.label}
                              {f.dependsOn && <span title={`Conditional: ${getConditionDescription(f)}`} className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-bold">⚡ Conditional</span>}
                              <Tooltip text={f.dependsOn ? `${f.tooltip}\n\n⚡ ${getConditionDescription(f)}` : f.tooltip} />
                              {f.required && <span className="text-red-500">*</span>}
                            </label>
                          </div>
                          {isAdmin && (
                            <div className="flex gap-2">
                              <button onClick={() => openFieldEditModal(f.id, section.id, f.type, f.options, f.label)} title="Edit Field" className="text-slate-300 hover:text-yellow-500"><PenTool size={14}/></button>
                              <button onClick={() => toggleFieldRequired(section.id, f.id)} title={f.required ? 'Remove Required' : 'Mark Required'} className={`transition-colors p-1 ${f.required ? 'text-red-500 bg-red-50 rounded' : 'text-slate-300 hover:text-orange-500'}`}><CheckSquare size={14}/></button>
                              <button onClick={() => toggleFieldAllowComments(section.id, f.id)} title={f.allowComments ? 'Disable Comments' : 'Allow Comments'} className={`transition-colors p-1 ${f.allowComments ? 'text-blue-500 bg-blue-50 rounded' : 'text-slate-300 hover:text-blue-500'}`}>💬</button>
                              <button onClick={() => moveField(section.id, fIdx, 'up')} className="text-slate-300 hover:text-blue-500"><ArrowUp size={14}/></button>
                              <button onClick={() => moveField(section.id, fIdx, 'down')} className="text-slate-300 hover:text-blue-500"><ArrowDown size={14}/></button>
                              <button onClick={() => removeField(section.id, f.id)} className="text-slate-300 hover:text-red-500"><Trash2 size={14} /></button>
                            </div>
                          )}
                        </div>

                        {isAdmin && editingFieldId === f.id && editingFieldSectionId === section.id && (
                          <div className="mb-4 p-3 rounded-xl border-2 border-[#DADDE3] bg-slate-50 space-y-3">
                            <p className="text-[10px] font-black uppercase tracking-wider text-slate-600">Edit Question</p>
                            <div>
                              <label className="text-[10px] font-black uppercase text-[#111111]">Question Label</label>
                              <input
                                type="text"
                                className="w-full mt-1 p-2 bg-white rounded-lg font-bold text-xs border-2 border-[#AAAAAA] focus:border-[#85144B] outline-none text-[#111111]"
                                value={editingFieldNewLabel}
                                onChange={(e) => setEditingFieldNewLabel(e.target.value)}
                              />
                            </div>

                            <div>
                              <label className="text-[10px] font-black uppercase text-[#111111]">Question Type</label>
                              <select
                                className="w-full mt-1 p-2 bg-white rounded-lg font-bold text-xs border-2 border-[#AAAAAA] focus:border-[#85144B] outline-none text-[#111111]"
                                value={editFieldType}
                                onChange={(e) => setEditFieldType(e.target.value as FieldType)}
                              >
                                {(['text', 'number', 'date', 'select', 'multi_select', 'checkbox', 'image', 'gps', 'group', 'dynamic_series'] as FieldType[]).map(t => (
                                  <option key={t} value={t}>{getFieldTypeLabel(t)}</option>
                                ))}
                              </select>
                            </div>

                            {(editFieldType === 'select' || editFieldType === 'multi_select') && (
                              <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-[#111111]">Options</label>
                                {editFieldOptions.map((opt, idx) => (
                                  <div key={`${f.id}-opt-${idx}`} className="flex gap-2">
                                    <input
                                      type="text"
                                      className="flex-1 p-2 bg-white rounded-lg font-bold text-xs border-2 border-[#AAAAAA] focus:border-[#85144B] outline-none text-[#111111]"
                                      value={opt}
                                      onChange={(e) => {
                                        const next = [...editFieldOptions];
                                        next[idx] = e.target.value;
                                        setEditFieldOptions(next);
                                      }}
                                    />
                                    <button
                                      type="button"
                                      onClick={() => setEditFieldOptions(editFieldOptions.filter((_, i) => i !== idx))}
                                      className="px-2 py-1 text-xs font-black rounded bg-red-100 text-red-600 hover:bg-red-200"
                                    >
                                      X
                                    </button>
                                  </div>
                                ))}
                                <button
                                  type="button"
                                  onClick={() => setEditFieldOptions([...editFieldOptions, ''])}
                                  className="px-3 py-1 text-[10px] font-black rounded bg-[#001F3F] text-[#39CCCC]"
                                >
                                  + Add Option
                                </button>
                              </div>
                            )}

                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={async () => {
                                  if (!editingFieldSectionId || !editingFieldId) return;
                                  if (!editingFieldNewLabel.trim()) {
                                    alert('Question label cannot be empty.');
                                    return;
                                  }
                                  setFieldSaveStatus('saving');
                                  await saveFieldEditsAtomic(editingFieldSectionId, editingFieldId, editingFieldNewLabel, editFieldType, editFieldOptions);
                                  setFieldSaveStatus('saved');
                                  setTimeout(() => {
                                    setEditingFieldId(null);
                                    setEditingFieldSectionId(null);
                                    setFieldSaveStatus('idle');
                                  }, 500);
                                }}
                                className="px-3 py-2 text-[10px] font-black rounded bg-[#85144B] text-white hover:bg-[#600e35]"
                              >
                                {fieldSaveStatus === 'saving' ? 'Saving...' : fieldSaveStatus === 'saved' ? 'Saved' : 'Save'}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingFieldId(null);
                                  setEditingFieldSectionId(null);
                                  setFieldSaveStatus('idle');
                                }}
                                className="px-3 py-2 text-[10px] font-black rounded bg-slate-200 text-slate-700 hover:bg-slate-300"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}

                        {f.type === 'text' && (
                          f.autoDate ? (
                            <input 
                              type="text" 
                              readOnly
                              className="w-full p-3 bg-slate-100 rounded-xl font-bold text-sm border-2 border-[#AAAAAA] text-[#111111] cursor-not-allowed"
                              value={formData[f.label] || (() => {
                                const today = new Date();
                                return `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
                              })()}
                            />
                          ) : (
                            <input 
                              type="text" 
                              className="w-full p-3 bg-[#FFFFFF] rounded-xl font-bold text-sm border-2 border-[#AAAAAA] focus:border-[#85144B] outline-none text-[#111111]" 
                              placeholder="..." 
                              value={formData[f.label] || ''} 
                              onChange={(e) => setFormData({...formData, [f.label]: e.target.value})} 
                            />
                          )
                        )}
                        {f.type === 'date' && (
                          <input 
                            type="date" 
                            className="w-full p-3 bg-[#FFFFFF] rounded-xl font-bold text-sm border-2 border-[#AAAAAA] focus:border-[#85144B] outline-none text-[#111111]" 
                            value={formData[f.label] || ''} 
                            onChange={(e) => setFormData({...formData, [f.label]: e.target.value})} 
                          />
                        )}
                        {f.type === 'number' && <input type="number" className="w-full p-3 bg-[#FFFFFF] rounded-xl font-bold text-sm border-2 border-[#AAAAAA] focus:border-[#85144B] outline-none text-[#111111]" placeholder="0" value={formData[f.label] || ''} onChange={(e) => setFormData({...formData, [f.label]: e.target.value})} />}
                        
                        {f.type === 'select' && (
                          <div className="relative">
                            <select className="w-full p-3 bg-[#FFFFFF] rounded-xl font-bold text-sm border-2 border-[#AAAAAA] focus:border-[#85144B] appearance-none text-[#111111] outline-none" value={formData[f.label] || ''} onChange={(e) => setFormData({...formData, [f.label]: e.target.value})}>
                              <option value="">Select...</option>
                              {f.options?.map((o, i) => <option key={i} value={o}>{o}</option>)}
                            </select>
                            <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 rotate-90 text-[#AAAAAA]" size={20} />
                          </div>
                        )}

                        {f.type === 'multi_select' && (
                          <MultiSelect options={f.options || []} value={formData[f.label] || []} onChange={(val) => setFormData({...formData, [f.label]: val})} />
                        )}

                        {f.type === 'dynamic_series' && (
                          <DynamicSeries value={formData[f.label] || []} onChange={(val) => setFormData({...formData, [f.label]: val})} darkModeProp={darkMode} />
                        )}

                        {f.type === 'group' && f.subFields && (
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                            {f.subFields.map((sub, idx) => (
                              <div key={idx}>
                                <p className="text-[9px] font-bold text-slate-500 uppercase mb-1">{sub.label}</p>
                                {sub.type === 'text' && <input type="text" className="w-full p-2 bg-white rounded-lg border border-slate-300 text-xs font-bold text-black" value={formData[`${f.label} [${sub.label}]`] || ''} onChange={(e) => setFormData({...formData, [`${f.label} [${sub.label}]`]: e.target.value})} />}
                                {sub.type === 'number' && <input type="number" className="w-full p-2 bg-white rounded-lg border border-slate-300 text-xs font-bold text-black" value={formData[`${f.label} [${sub.label}]`] || ''} onChange={(e) => setFormData({...formData, [`${f.label} [${sub.label}]`]: e.target.value})} />}
                                {sub.type === 'select' && (
                                  <select className="w-full p-2 bg-white rounded-lg border border-slate-300 text-xs font-bold text-black" value={formData[`${f.label} [${sub.label}]`] || ''} onChange={(e) => setFormData({...formData, [`${f.label} [${sub.label}]`]: e.target.value})}>
                                    <option value="">Select...</option>
                                    {sub.options?.map(o => <option key={o} value={o}>{o}</option>)}
                                  </select>
                                )}
                                {sub.type === 'checkbox' && (
                                  <input type="checkbox" className="w-5 h-5 accent-[#2ECC40]" checked={!!formData[`${f.label} [${sub.label}]`]} onChange={(e) => setFormData({...formData, [`${f.label} [${sub.label}]`]: e.target.checked})} />
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {f.type === 'image' && <ImageUpload label={f.label} value={formData[f.label] || []} onChange={(imgs) => setFormData({...formData, [f.label]: imgs})} />}
                        
                        {f.type === 'gps' && (
                          <div className="flex gap-2">
                            <input type="text" readOnly className="flex-1 p-3 bg-slate-100 rounded-xl font-mono text-xs border-2 text-black" value={formData[f.label] || 'Waiting for signal...'} />
                            <button onClick={() => captureGPS(f.label)} className="bg-[#85144B] text-white p-3 rounded-xl hover:bg-[#600e35] flex items-center justify-center gap-2"><Loader2 className={locating ? "animate-spin" : "hidden"} size={18} /> <MapPin size={18} /></button>
                          </div>
                        )}
                        
                        {f.type === 'checkbox' && (
                          <label className="flex items-center gap-4 p-3 bg-slate-50 rounded-xl border-2 border-transparent hover:border-[#2ECC40] transition-all cursor-pointer">
                            <input type="checkbox" className="w-6 h-6 accent-[#2ECC40] rounded" checked={!!formData[f.label]} onChange={(e) => setFormData({...formData, [f.label]: e.target.checked})} />
                            <span className="text-xs font-bold uppercase text-[#111111]">Verified</span>
                          </label>
                        )}

                        {f.allowComments && (
                          <textarea placeholder="Add explanation or additional notes (optional)" className="w-full p-3 bg-[#FFFFFF] rounded-xl font-bold text-sm border-2 border-[#CCCCCC] focus:border-[#85144B] outline-none text-[#111111] min-h-24 resize-none" value={formData[`${f.label}_comment`] || ''} onChange={(e) => setFormData({...formData, [`${f.label}_comment`]: e.target.value})} />
                        )}
                      </div>
                    )
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {surveyTab === 'typology' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 border-b-4 border-[#001F3F] pb-2">
              <Layers className="text-[#001F3F]" size={20} />
              <h2 className="text-sm font-black text-[#001F3F] uppercase tracking-widest">Building Typology</h2>
            </div>

            <div className="bg-white p-4 sm:p-6 rounded-2xl border-2 border-slate-100 shadow-sm relative hover:border-blue-200 transition-colors">
              <div className="mb-3">
                <label className="text-[10px] sm:text-xs font-black uppercase text-[#111111]">Typology Selection</label>
                <div className="relative mt-2">
                  <select
                    className="w-full p-3 bg-[#FFFFFF] rounded-xl font-bold text-sm border-2 border-[#AAAAAA] focus:border-[#85144B] appearance-none text-[#111111] outline-none"
                    value={currentTypologyData.selected_type || ''}
                    onChange={(e) => updateTypologySelectedType(e.target.value)}
                  >
                    <option value="">Select...</option>
                    {TYPOLOGY_DEFINITIONS.map(def => (
                      <option key={def.label} value={def.label}>{def.label}</option>
                    ))}
                  </select>
                  <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 rotate-90 text-[#AAAAAA]" size={20} />
                </div>
              </div>

              {selectedTypologyDefinition && (
                <div className="grid grid-cols-1 gap-4">
                  {selectedTypologyDefinition.fields.map(field => {
                    if (!isTypologyFieldVisible(field, currentTypologyData.responses || {})) return null;

                    const group = TYPOLOGY_FIELD_GROUP_BY_ID[field.id];
                    if (group) {
                      // Render the grouped question once, at the first visible member field.
                      const visibleMemberFields = selectedTypologyDefinition.fields.filter(
                        member => group.fieldIds.includes(member.id) && isTypologyFieldVisible(member, currentTypologyData.responses || {})
                      );
                      if (visibleMemberFields.length === 0) return null;
                      if (visibleMemberFields[0].id !== field.id) return null;

                      return (
                        <div key={group.id}>
                          <label className="text-[10px] sm:text-xs font-black uppercase text-[#111111]">{group.label}</label>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
                            {visibleMemberFields.map(memberField => (
                              <div key={memberField.id}>
                                <label className="text-[10px] font-black uppercase text-[#111111]">
                                  {group.subLabels[memberField.id] || memberField.label}
                                </label>
                                <input
                                  type="number"
                                  className="w-full mt-1 p-3 bg-[#FFFFFF] rounded-xl font-bold text-sm border-2 border-[#AAAAAA] focus:border-[#85144B] outline-none text-[#111111]"
                                  placeholder="..."
                                  value={currentTypologyData.responses?.[memberField.id] || ''}
                                  onChange={(e) => updateTypologyResponse(memberField.id, e.target.value)}
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div key={field.id}>
                        <label className="text-[10px] sm:text-xs font-black uppercase text-[#111111]">{field.label}</label>
                        {field.type === 'select' ? (
                          <div className="relative mt-1">
                            <select
                              className="w-full p-3 bg-[#FFFFFF] rounded-xl font-bold text-sm border-2 border-[#AAAAAA] focus:border-[#85144B] appearance-none text-[#111111] outline-none"
                              value={currentTypologyData.responses?.[field.id] || ''}
                              onChange={(e) => updateTypologyResponse(field.id, e.target.value)}
                            >
                              <option value="">Select...</option>
                              {(field.options || []).map(option => (
                                <option key={option} value={option}>{option}</option>
                              ))}
                            </select>
                            <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 rotate-90 text-[#AAAAAA]" size={20} />
                          </div>
                        ) : (
                          <input
                            type={field.type === 'number' ? 'number' : 'text'}
                            className="w-full mt-1 p-3 bg-[#FFFFFF] rounded-xl font-bold text-sm border-2 border-[#AAAAAA] focus:border-[#85144B] outline-none text-[#111111]"
                            placeholder="..."
                            value={currentTypologyData.responses?.[field.id] || ''}
                            onChange={(e) => updateTypologyResponse(field.id, e.target.value)}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {!isAdmin && (
        <>
          {/* Surveyor Name Modal */}
          {showSurveyorModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border-4 border-[#001F3F]">
                <h2 className="text-lg font-black text-[#001F3F] mb-2">👤 What's your name??</h2>
                <p className="text-xs text-slate-600 mb-4">Enter your name</p>
                <input 
                  type="text" 
                  placeholder="Your name" 
                  className="w-full p-3 border-2 border-[#AAAAAA] rounded-xl text-black font-bold mb-4 focus:border-[#85144B] outline-none"
                  value={tempSurveyorName}
                  onChange={(e) => setTempSurveyorName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSaveSurveyorName()}
                />
                <button 
                  onClick={handleSaveSurveyorName}
                  className="w-full bg-[#85144B] text-white font-black py-3 rounded-xl hover:bg-[#600e35] transition-all"
                >
                  GET STARTED
                </button>
              </div>
            </div>
          )}

          {/* Field Edit Modal - ENHANCED */}
          {/* Field edit panel now renders inline below fields */}

          {/* New Survey / Keyboard Shortcuts */}
          <div className="space-y-3 mb-4">
            {surveyorName && Object.keys(formData).length > 0 && (
              <button 
                onClick={startNewSurvey}
                className="w-full bg-[#39CCCC] text-[#001F3F] font-black py-3 rounded-2xl shadow-lg hover:scale-[1.01] active:scale-[0.98] transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-xs"
              >
                <Plus size={18} /> START NEW SURVEY
              </button>
            )}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-[9px]">
              <p className="font-bold text-blue-900 mb-2">⌨️ Keyboard Shortcuts:</p>
              <p className="text-blue-800"><kbd className="bg-white border rounded px-1">Ctrl+S</kbd> Submit Form | <kbd className="bg-white border rounded px-1">Escape</kbd> Close Modals</p>
            </div>
          </div>

          {/* NEW: Download for Offline Use Button UI */}
          {installPrompt && (
            <div className="flex justify-center mb-4">
              <button 
                onClick={handleOfflineInstall}
                className="btn btn-outline btn-sm border-2 border-emerald-600 text-emerald-800 rounded-2xl px-6 font-black uppercase tracking-widest text-[10px] gap-2 hover:bg-emerald-50"
              >
                <HardDrive size={14} /> Download for Offline Use
              </button>
            </div>
          )}

          <button onClick={submitReport} className="w-full bg-[#85144B] text-[#FFFFFF] font-black py-5 rounded-[2rem] shadow-xl hover:scale-[1.01] active:scale-[0.98] transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-xs sticky bottom-4 z-10 border-4 border-white ring-2 ring-slate-100">
            <CheckSquare size={18} /> {isOnline ? 'SUBMIT PROFORMA' : 'SAVE LOCALLY'}
          </button>
        </>
      )}

      {/* Dark Mode Styles (basic overrides) */}
      {darkMode && (
        <style>{`
          body { background-color: #0f172a !important; color: #f8fafc !important; }
          input, select, textarea, button { background-color: #0b1220 !important; color: #f8fafc !important; border-color: #334155 !important; }
          .bg-white { background-color: #0b1220 !important; }
          .text-black { color: #f8fafc !important; }
        `}</style>
      )}

      {viewingImages && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4">
            <button onClick={() => setViewingImages(null)} className="absolute top-4 right-4 text-white"><X size={32}/></button>
            <div className="grid grid-cols-2 gap-4 max-h-[80vh] overflow-y-auto">
                {viewingImages.map((img, i) => <img key={i} src={img.url} className="w-full rounded border-2 border-[#39CCCC]" />)}
            </div>
        </div>
      )}

      {editingReport && (
        <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="font-black text-lg text-[#001F3F]">FULL DATA EDITOR</h3>
              <button onClick={() => setEditingReport(null)}><X /></button>
            </div>
            
            {sections.map(sec => (
              <div key={sec.id} className="space-y-3 border-b pb-4">
                <h4 className="text-xs font-black text-[#85144B] uppercase tracking-widest">{sec.title}</h4>
                {sec.fields.map(f => (
                  <div key={f.id} className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-slate-900">{f.label}</label>
                    {f.type === 'text' && <input type="text" className="w-full p-3 bg-slate-50 rounded-xl font-bold border text-black" value={editingReport.full_data[f.label] || ''} onChange={(e) => handleEditChange(f.label, e.target.value)} />}
                    {f.type === 'date' && <input type="date" className="w-full p-3 bg-slate-50 rounded-xl font-bold border text-black" value={editingReport.full_data[f.label] || ''} onChange={(e) => handleEditChange(f.label, e.target.value)} />}
                    {f.type === 'number' && <input type="number" className="w-full p-3 bg-slate-50 rounded-xl font-bold border text-black" value={editingReport.full_data[f.label] || ''} onChange={(e) => handleEditChange(f.label, e.target.value)} />}
                    {f.type === 'select' && (
                       <select className="w-full p-3 bg-slate-50 rounded-xl font-bold border text-black" value={editingReport.full_data[f.label] || ''} onChange={(e) => handleEditChange(f.label, e.target.value)}>
                          <option value="">Select...</option>
                          {f.options?.map(o => <option key={o} value={o}>{o}</option>)}
                       </select>
                    )}
                    {f.type === 'multi_select' && (
                        <MultiSelect options={f.options || []} value={editingReport.full_data[f.label] || []} onChange={(val) => handleEditChange(f.label, val)} />
                    )}
                    {f.type === 'dynamic_series' && (
                        <DynamicSeries value={editingReport.full_data[f.label] || []} onChange={(val) => handleEditChange(f.label, val)} darkModeProp={darkMode} />
                    )}
                    {f.type === 'group' && f.subFields && (
                       <div className="grid grid-cols-2 gap-2 bg-slate-100 p-2 rounded">
                          {f.subFields.map(sub => (
                             <div key={sub.id}>
                                <p className="text-[9px] font-bold text-black">{sub.label}</p>
                                <input type="text" className="w-full p-2 bg-white rounded border text-black" 
                                    value={editingReport.full_data[`${f.label} [${sub.label}]`] || ''} 
                                    onChange={(e) => handleEditChange(`${f.label} [${sub.label}]`, e.target.value)} />
                             </div>
                          ))}
                       </div>
                    )}
                    {f.type === 'checkbox' && (
                       <div className="flex items-center gap-2">
                         <input type="checkbox" className="w-5 h-5 accent-[#85144B]" checked={!!editingReport.full_data[f.label]} onChange={(e) => handleEditChange(f.label, e.target.checked)} />
                         <span className="text-xs font-bold text-black">Verified</span>
                       </div>
                    )}
                    {f.allowComments && (
                       <textarea placeholder="Add explanation or additional notes (optional)" className="w-full p-3 bg-slate-50 rounded-xl font-bold text-sm border-2 border-slate-300 text-black min-h-24 resize-none" value={editingReport.full_data[`${f.label}_comment`] || ''} onChange={(e) => handleEditChange(`${f.label}_comment`, e.target.value)} />
                    )}
                    {f.type === 'image' && (
                       <ImageUpload label={f.label} value={editingReport.full_data[f.label] || []} onChange={(imgs) => handleEditChange(f.label, imgs)} />
                    )}
                    {f.type === 'gps' && <input type="text" className="w-full p-3 bg-slate-100 font-mono text-xs border text-black" value={editingReport.full_data[f.label] || ''} readOnly />}
                  </div>
                ))}
              </div>
            ))}

            <button onClick={saveEditedReport} className="w-full bg-[#001F3F] text-[#39CCCC] py-4 rounded-xl font-black uppercase text-sm sticky bottom-0 shadow-xl">SAVE ALL CHANGES</button>
          </div>
        </div>
      )}

    </div>
  );
}