// Minimal stand-in for the Pebble SDK header, enough to compile c/cgm.c on a PC.
#pragma once
#include <stdint.h>
#include <stdbool.h>
#include <string.h>
#include <time.h>
#include <stdio.h>
typedef struct AppTimer AppTimer;
typedef void (*AppTimerCallback)(void*);
AppTimer* app_timer_register(uint32_t, AppTimerCallback, void*);
void app_timer_cancel(AppTimer*);
typedef struct { int32_t int32; char cstring[8]; } TupleValue;
typedef struct { TupleValue *value; } Tuple;
typedef struct DictionaryIterator DictionaryIterator;
Tuple *dict_find(DictionaryIterator*, uint32_t);
typedef enum { APP_MSG_OK=0, APP_MSG_BUSY } AppMessageResult;
AppMessageResult app_message_outbox_begin(DictionaryIterator**);
AppMessageResult app_message_outbox_send(void);
int dict_write_uint8(DictionaryIterator*, uint32_t, uint8_t);
bool persist_exists(uint32_t); int persist_read_data(uint32_t, void*, size_t); int persist_write_data(uint32_t,const void*,size_t);
typedef struct { int16_t x,y; } GPoint; typedef struct { int16_t x,y,w,h; } GRect; typedef struct {uint8_t argb;} GColor; typedef struct GContext GContext;
#define GPoint(a,b) ((GPoint){(a),(b)})
#define GRect(a,b,c,d) ((GRect){(a),(b),(c),(d)})
#define GCornersAll 15
void graphics_context_set_fill_color(GContext*,GColor); void graphics_fill_circle(GContext*,GPoint,int); void graphics_fill_rect(GContext*,GRect,int,int);
